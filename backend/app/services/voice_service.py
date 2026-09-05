"""Bridge between the voice provider layer and our persistence layer.

Converts a provider-neutral `VoiceCallState` into `VoiceCall` + `Conversation` +
`ConversationTurn` rows, and back again when refreshing an in-flight call.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.base import ensure_utc
from app.integrations.hunar.base import ScriptedTurn, VoiceCallState
from app.integrations.hunar.service import get_voice_provider
from app.models.conversation import Conversation, ConversationTurn, VoiceCall


def persist_call(
    db: Session, state: VoiceCallState, *, existing: VoiceCall | None = None
) -> VoiceCall:
    call = existing or VoiceCall()
    call.provider = state.provider
    call.provider_call_id = state.provider_call_id
    call.provider_agent_id = state.provider_agent_id
    call.request_id = state.request_id
    call.status = state.status
    call.lifecycle_status = state.lifecycle_status
    call.recording_url = state.recording_url
    call.duration_seconds = state.duration_seconds
    call.answered_by = state.answered_by
    call.engagement_status = state.engagement_status
    call.result = state.result or {}
    call.provider_payload = state.raw_payload or {}
    call.error_message = state.error_message
    if state.started_at:
        call.started_at = state.started_at
    if state.ended_at:
        call.ended_at = state.ended_at

    if existing is None:
        db.add(call)
    db.flush()
    return call


def to_state(call: VoiceCall) -> VoiceCallState:
    return VoiceCallState(
        provider=call.provider,
        provider_call_id=call.provider_call_id or "",
        provider_agent_id=call.provider_agent_id,
        request_id=call.request_id,
        status=call.status,
        lifecycle_status=call.lifecycle_status,
        recording_url=call.recording_url,
        duration_seconds=call.duration_seconds,
        answered_by=call.answered_by,
        engagement_status=call.engagement_status,
        result=call.result or {},
        raw_payload=call.provider_payload or {},
        started_at=ensure_utc(call.started_at),
        ended_at=ensure_utc(call.ended_at),
    )


def refresh_call(db: Session, call: VoiceCall, *, force_complete: bool = False) -> VoiceCallState:
    """Ask the provider for the latest snapshot and write it back."""
    provider = get_voice_provider()
    state = to_state(call)
    state = provider.finalize_call(state) if force_complete else provider.refresh_call(state)
    persist_call(db, state, existing=call)
    return state


def sync_turns(db: Session, conversation: Conversation, turns: list[ScriptedTurn]) -> int:
    """Append any turns not yet stored. Returns how many were added."""
    existing = len(conversation.turns)
    if len(turns) <= existing:
        return 0

    for index, turn in enumerate(turns[existing:], start=existing):
        db.add(
            ConversationTurn(
                conversation_id=conversation.id,
                sequence=index,
                speaker=turn.speaker,
                content=turn.content,
                offset_seconds=turn.offset_seconds,
                meta=turn.meta or {},
            )
        )
    db.flush()
    db.refresh(conversation)
    return len(turns) - existing
