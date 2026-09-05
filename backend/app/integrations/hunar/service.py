"""Live Hunar voice provider plus the provider factory.

KNOWN PLATFORM LIMITATION
-------------------------
The Hunar external API (v1) exposes agents, calls and phone numbers. It returns a
`recording_url` and a schema-driven `result` object for a completed call, but it
does **not** expose a turn-by-turn transcript endpoint. HireFlow therefore treats
the structured `result` as the primary machine-readable output of a live call and
stores whatever conversation content the platform does return. Transcript
timelines are always populated for demo calls, and for live calls only to the
extent the platform provides them. The UI states which of the two it is showing.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.hunar.agents import AgentBlueprint
from app.integrations.hunar.base import (
    ScriptedTurn,
    VoiceCallSpec,
    VoiceCallState,
    VoiceProviderProtocol,
)
from app.integrations.hunar.client import HunarClient
from app.integrations.hunar.demo import DemoVoiceProvider
from app.integrations.hunar.health import check_hunar, reset_cache
from app.integrations.hunar.models import CallbackConfig, CallCreateRequest, CallResource

logger = get_logger(__name__)

# Hosts that a third-party webhook can never reach back on.
_PRIVATE_HOST_PREFIXES = (
    "localhost",
    "127.",
    "0.0.0.0",
    "::1",
    "10.",
    "192.168.",
    "host.docker.internal",
)


def is_publicly_reachable(url: str) -> bool:
    """True when an external service could actually deliver a webhook to `url`."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host or host.endswith(".local"):
        return False
    if any(
        host == prefix.rstrip(".") or host.startswith(prefix) for prefix in _PRIVATE_HOST_PREFIXES
    ):
        return False
    # 172.16.0.0 - 172.31.255.255
    if host.startswith("172."):
        try:
            if 16 <= int(host.split(".")[1]) <= 31:
                return False
        except (IndexError, ValueError):
            pass
    return True


# Agent ids are stable for the lifetime of the process; re-creating an identical
# agent on every call would be wasteful and would pollute the Hunar workspace.
_AGENT_CACHE: dict[str, str] = {}


class HunarVoiceProvider:
    """Places real outbound calls through Hunar.ai."""

    name = "hunar"

    def __init__(self, client: HunarClient | None = None) -> None:
        self._client = client or HunarClient()

    def ensure_agent(self, blueprint: AgentBlueprint) -> str:
        """Reuse an existing agent with the same name, otherwise create one."""
        if blueprint.name in _AGENT_CACHE:
            return _AGENT_CACHE[blueprint.name]

        try:
            existing = self._client.list_agents(page_size=100)
            for item in existing.results:
                if item.get("name") == blueprint.name and item.get("id"):
                    _AGENT_CACHE[blueprint.name] = str(item["id"])
                    return _AGENT_CACHE[blueprint.name]
        except Exception:  # noqa: BLE001 - listing is an optimisation, not a hard dependency
            logger.warning("Could not list Hunar agents; falling back to create", exc_info=True)

        agent = self._client.create_agent(blueprint.to_create_request())
        _AGENT_CACHE[blueprint.name] = agent.id
        logger.info("Created Hunar agent %s (%s)", agent.name, agent.id)
        return agent.id

    def _callback_config(self) -> CallbackConfig | None:
        """Webhook URLs, or None when this deployment has no public address.

        Hunar validates callback URLs and rejects the whole call if they are not
        publicly reachable, so a local development backend must omit them rather
        than send `http://localhost:8000/...`. Locally we fall back to polling,
        which produces the same result via the same state machine.
        """
        base = settings.public_backend_url.rstrip("/")
        if not is_publicly_reachable(base):
            logger.debug(
                "PUBLIC_BACKEND_URL (%s) is not publicly reachable; "
                "omitting webhook callbacks and relying on polling.",
                base,
            )
            return None

        hook = f"{base}{settings.api_v1_prefix}/webhooks/hunar"
        return CallbackConfig(
            call_status_callback_url=hook,
            call_recording_callback_url=hook,
            call_result_callback_url=hook,
            call_summary_callback_url=hook,
        )

    def place_call(self, spec: VoiceCallSpec) -> VoiceCallState:
        agent_id = self.ensure_agent(spec.blueprint)
        payload = CallCreateRequest(
            agent_id=agent_id,
            callee_name=spec.callee_name,
            mobile_number=spec.mobile_number,
            custom_data=spec.custom_data or None,
            from_phone_number=settings.hunar_from_phone_number or None,
            request_id=spec.request_id,
            callback_config=self._callback_config(),
        )
        call = self._client.create_call(payload)
        return _to_state(call, agent_id=agent_id)

    def refresh_call(self, state: VoiceCallState) -> VoiceCallState:
        call = self._client.get_call(state.provider_call_id)
        refreshed = _to_state(call, agent_id=state.provider_agent_id)
        # Preserve any transcript content already captured via webhooks.
        refreshed.turns = refreshed.turns or state.turns
        return refreshed

    def finalize_call(self, state: VoiceCallState) -> VoiceCallState:
        """A real call ends when the telephony platform says so - just re-read it."""
        return self.refresh_call(state)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_state(call: CallResource, *, agent_id: str | None) -> VoiceCallState:
    payload = call.model_dump(mode="json")
    return VoiceCallState(
        provider=HunarVoiceProvider.name,
        provider_call_id=call.id,
        provider_agent_id=call.agent_id or agent_id,
        request_id=call.request_id,
        status=call.status or "NOT_STARTED",
        lifecycle_status=call.lifecycle_status or call.status or "NOT_STARTED",
        recording_url=call.recording_url,
        duration_seconds=call.duration_seconds,
        answered_by=call.answered_by,
        engagement_status=call.engagement_status,
        result=call.result or {},
        turns=_extract_turns(payload),
        raw_payload=payload,
        started_at=_parse_dt(call.started_at),
        ended_at=_parse_dt(call.ended_at),
    )


def _extract_turns(payload: dict) -> list[ScriptedTurn]:
    """Best-effort transcript extraction.

    The documented call resource has no transcript field. If a workspace is
    configured to return one under a conventional key we will use it; otherwise
    the timeline stays empty and the UI says so rather than fabricating turns.
    """
    raw = payload.get("transcript") or payload.get("conversation") or []
    if not isinstance(raw, list):
        return []
    turns: list[ScriptedTurn] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        speaker = str(item.get("speaker") or item.get("role") or "agent").lower()
        speaker = "candidate" if speaker in {"user", "candidate", "customer"} else "agent"
        content = item.get("text") or item.get("content") or ""
        if not content:
            continue
        turns.append(
            ScriptedTurn(
                speaker=speaker,
                content=str(content),
                offset_seconds=float(item.get("offset_seconds") or index * 5),
            )
        )
    return turns


class ResilientVoiceProvider:
    """Prefers live calling, but never lets a live failure break the product.

    Three things can go wrong with a live call: the key expires, the platform is
    unreachable, or the telephony provider rejects the number. In every case the
    conversation falls back to the demo provider so the workflow still completes
    and the recruiter still gets a result - the record simply carries
    `provider="demo"` and the reason.

    Refreshes are routed by the provider that actually placed the call, so a
    simulated call is never polled against the live API and vice versa.
    """

    name = "resilient"

    def __init__(self) -> None:
        self._live = HunarVoiceProvider()
        self._demo = DemoVoiceProvider()

    def _demo_with_reason(self, spec: VoiceCallSpec, reason: str) -> VoiceCallState:
        state = self._demo.place_call(spec)
        state.raw_payload["fallback_reason"] = reason
        return state

    def place_call(self, spec: VoiceCallSpec) -> VoiceCallState:
        # The caller decides whether this particular number may be dialled.
        if not spec.allow_live:
            return self._demo_with_reason(spec, spec.simulation_reason or "Live calling disabled.")

        if not settings.live_voice_enabled:
            return self._demo_with_reason(
                spec, "DEMO_MODE is enabled, so the conversation is simulated."
            )

        health = check_hunar()
        if not health.usable:
            return self._demo_with_reason(spec, health.reason)

        try:
            return self._live.place_call(spec)
        except Exception as exc:  # noqa: BLE001 - any live failure degrades, never 500s
            reason = getattr(exc, "message", None) or str(exc)
            logger.warning("Live Hunar call failed, falling back to simulation: %s", reason)
            # Re-check on the next call rather than trusting a stale "healthy".
            reset_cache()
            return self._demo_with_reason(spec, f"Hunar call failed: {reason}")

    def _for(self, state: VoiceCallState):
        return self._live if state.provider == HunarVoiceProvider.name else self._demo

    def refresh_call(self, state: VoiceCallState) -> VoiceCallState:
        try:
            return self._for(state).refresh_call(state)
        except Exception as exc:  # noqa: BLE001 - a poll failure must not break the UI
            logger.warning("Could not refresh call %s: %s", state.provider_call_id, exc)
            return state

    def finalize_call(self, state: VoiceCallState) -> VoiceCallState:
        try:
            return self._for(state).finalize_call(state)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not finalize call %s: %s", state.provider_call_id, exc)
            return state


def get_voice_provider() -> VoiceProviderProtocol:
    """Return the provider that should handle calls right now.

    Always the resilient wrapper: it decides per call whether to dial for real,
    and degrades to simulation whenever live calling is unavailable.
    """
    return ResilientVoiceProvider()


def voice_mode() -> str:
    """Best-known calling mode, used for badges and status reporting."""
    if not settings.live_voice_enabled:
        return "demo"
    return "live" if check_hunar().usable else "demo"
