"""Provider-agnostic voice calling contract.

`HunarVoiceProvider` places real telephone calls through Hunar.ai.
`DemoVoiceProvider` replays a scripted conversation on a compressed timeline.

Both satisfy the same protocol, so every service, route and UI screen above this
line is identical regardless of which one is active. The active provider is
always reported to the client so a demo is never mistaken for a live call.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from app.integrations.hunar.agents import AgentBlueprint


@dataclass(slots=True)
class ScriptedTurn:
    """One utterance on the demo timeline."""

    speaker: str
    content: str
    offset_seconds: float
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class VoiceCallSpec:
    """Everything needed to launch a call, provider-independent."""

    purpose: str  # "interview" | "outreach"
    blueprint: AgentBlueprint
    callee_name: str
    mobile_number: str
    custom_data: dict[str, Any] = field(default_factory=dict)
    request_id: str | None = None
    # Whether this specific call may be dialled for real. Decided by
    # app/services/voice_policy.py - fabricated contact data is never called.
    allow_live: bool = True
    simulation_reason: str | None = None
    # Demo-only payload; ignored entirely by the live Hunar provider.
    demo_script: list[ScriptedTurn] = field(default_factory=list)
    demo_result: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class VoiceCallState:
    """Normalised snapshot of a call, whoever placed it."""

    provider: str
    provider_call_id: str
    provider_agent_id: str | None = None
    request_id: str | None = None
    status: str = "NOT_STARTED"
    lifecycle_status: str = "NOT_STARTED"
    recording_url: str | None = None
    duration_seconds: float | None = None
    answered_by: str | None = None
    engagement_status: str | None = None
    result: dict[str, Any] = field(default_factory=dict)
    turns: list[ScriptedTurn] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    error_message: str | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in {"COMPLETED", "NOT_CONNECTED", "CANCELLED", "FAILED"}


class VoiceProviderProtocol(Protocol):
    """The surface every voice provider must implement."""

    name: str

    def place_call(self, spec: VoiceCallSpec) -> VoiceCallState:
        """Create the agent if required and start the call."""
        ...

    def refresh_call(self, state: VoiceCallState) -> VoiceCallState:
        """Return the latest snapshot for an in-flight call."""
        ...

    def finalize_call(self, state: VoiceCallState) -> VoiceCallState:
        """Force a call to its terminal state (used by the demo fast-forward)."""
        ...
