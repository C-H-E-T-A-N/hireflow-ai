"""Demo voice provider.

THIS PROVIDER PLACES NO TELEPHONE CALLS. It replays a scripted conversation on a
compressed timeline so that the end-to-end product can be demonstrated without a
live Hunar subscription or real candidate phone numbers.

Anything it produces is tagged `provider="demo"` all the way to the UI, which
renders a persistent "Demo mode" badge. It is never presented as real API data.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from app.core.logging import get_logger
from app.integrations.hunar.base import (
    ScriptedTurn,
    VoiceCallSpec,
    VoiceCallState,
)

logger = get_logger(__name__)

# The demo timeline is compressed so a full conversation plays out in under a
# minute: real calls take minutes, and a live demo should not.
DIAL_SECONDS = 2.0
CONNECT_SECONDS = 4.0
WRAP_UP_SECONDS = 3.0


class DemoVoiceProvider:
    name = "demo"

    def place_call(self, spec: VoiceCallSpec) -> VoiceCallState:
        now = datetime.now(UTC)
        call_id = f"demo-{uuid.uuid4()}"
        logger.info(
            "Demo provider simulating a %s call for %s (no telephony involved)",
            spec.purpose,
            spec.callee_name,
        )
        return VoiceCallState(
            provider=self.name,
            provider_call_id=call_id,
            provider_agent_id=f"demo-agent-{spec.purpose}",
            request_id=spec.request_id,
            status="INITIATED",
            lifecycle_status="IN_PROGRESS",
            started_at=now,
            turns=[],
            result={},
            raw_payload={
                "simulated": True,
                "purpose": spec.purpose,
                "agent_name": spec.blueprint.name,
                "persona_name": spec.blueprint.persona_name,
                "custom_data": spec.custom_data,
                "script": [
                    {
                        "speaker": turn.speaker,
                        "content": turn.content,
                        "offset_seconds": turn.offset_seconds,
                        "meta": turn.meta,
                    }
                    for turn in spec.demo_script
                ],
                "pending_result": spec.demo_result,
                "total_seconds": _total_seconds(spec.demo_script),
            },
        )

    def refresh_call(self, state: VoiceCallState) -> VoiceCallState:
        payload = state.raw_payload or {}
        script = [_to_turn(item) for item in payload.get("script", [])]
        total = float(payload.get("total_seconds") or _total_seconds(script))
        started = state.started_at or datetime.now(UTC)
        elapsed = (datetime.now(UTC) - started).total_seconds()

        state.turns = [turn for turn in script if turn.offset_seconds <= elapsed]

        if elapsed < DIAL_SECONDS:
            state.status = "RINGING"
            state.lifecycle_status = "IN_PROGRESS"
        elif elapsed < total:
            state.status = "IN_PROGRESS"
            state.lifecycle_status = "IN_PROGRESS"
            state.answered_by = "HUMAN"
        else:
            return self.finalize_call(state)

        state.duration_seconds = round(elapsed, 1)
        return state

    def finalize_call(self, state: VoiceCallState) -> VoiceCallState:
        payload = state.raw_payload or {}
        script = [_to_turn(item) for item in payload.get("script", [])]
        total = float(payload.get("total_seconds") or _total_seconds(script))
        started = state.started_at or datetime.now(UTC)

        state.turns = script
        state.status = "COMPLETED"
        state.lifecycle_status = "COMPLETED"
        state.answered_by = "HUMAN"
        state.engagement_status = "ENGAGED"
        state.duration_seconds = round(total, 1)
        state.result = payload.get("pending_result", {}) or {}
        state.ended_at = started + timedelta(seconds=total)
        # Deliberately null: there is no audio because no call was placed.
        state.recording_url = None
        return state


def _to_turn(item: dict) -> ScriptedTurn:
    return ScriptedTurn(
        speaker=item.get("speaker", "agent"),
        content=item.get("content", ""),
        offset_seconds=float(item.get("offset_seconds", 0.0)),
        meta=item.get("meta", {}) or {},
    )


def _total_seconds(script: list[ScriptedTurn]) -> float:
    if not script:
        return CONNECT_SECONDS + WRAP_UP_SECONDS
    return max(turn.offset_seconds for turn in script) + WRAP_UP_SECONDS
