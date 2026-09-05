"""Voice call plumbing and the conversation record it produces.

`VoiceCall` is the single place where a provider-side call (Hunar or the demo
provider) is tracked. Both interviews and outreach point at one.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    ConversationStatus,
    SpeakerRole,
    VoiceCallStatus,
    VoiceProvider,
)


class VoiceCall(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "voice_calls"

    provider: Mapped[str] = mapped_column(String(20), default=VoiceProvider.DEMO, nullable=False)
    # Identifier returned by the provider (Hunar call uuid, or a demo call id).
    provider_call_id: Mapped[str | None] = mapped_column(String(120), index=True)
    provider_agent_id: Mapped[str | None] = mapped_column(String(120))
    request_id: Mapped[str | None] = mapped_column(String(120), index=True)

    status: Mapped[str] = mapped_column(
        String(30), default=VoiceCallStatus.NOT_STARTED, nullable=False, index=True
    )
    lifecycle_status: Mapped[str] = mapped_column(
        String(30), default=VoiceCallStatus.NOT_STARTED, nullable=False
    )
    callee_name: Mapped[str | None] = mapped_column(String(160))
    mobile_number: Mapped[str | None] = mapped_column(String(32))
    from_phone_number: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str | None] = mapped_column(String(30))

    recording_url: Mapped[str | None] = mapped_column(String(600))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    answered_by: Mapped[str | None] = mapped_column(String(30))
    engagement_status: Mapped[str | None] = mapped_column(String(30))
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Verbatim payloads we sent to / received from the provider, for auditing.
    custom_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    provider_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversation: Mapped[Conversation | None] = relationship(
        back_populates="voice_call", uselist=False
    )


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    channel: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(30), default=ConversationStatus.ACTIVE, nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(220))

    candidate_id: Mapped[str | None] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    voice_call_id: Mapped[str | None] = mapped_column(
        ForeignKey("voice_calls.id", ondelete="SET NULL"), unique=True
    )

    # Structured extraction distilled from the transcript / provider result.
    extracted_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    sentiment: Mapped[str | None] = mapped_column(String(30))
    key_moments: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    voice_call: Mapped[VoiceCall | None] = relationship(back_populates="conversation")
    turns: Mapped[list[ConversationTurn]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationTurn.sequence",
    )


class ConversationTurn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One utterance in a conversation timeline."""

    __tablename__ = "conversation_turns"

    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str] = mapped_column(String(20), default=SpeakerRole.AGENT, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Seconds from the start of the call.
    offset_seconds: Mapped[float | None] = mapped_column(Float)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="turns")
