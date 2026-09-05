"""AI voice outreach and the structured response extracted from it."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import InterestLevel, OutreachRecommendation, OutreachStatus

if TYPE_CHECKING:
    from app.models.conversation import Conversation, VoiceCall
    from app.models.recruiting import Candidate, Job


class Outreach(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "outreaches"

    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[str] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL")
    )
    voice_call_id: Mapped[str | None] = mapped_column(
        ForeignKey("voice_calls.id", ondelete="SET NULL")
    )

    campaign_name: Mapped[str | None] = mapped_column(String(160))
    agent_persona_name: Mapped[str] = mapped_column(String(80), default="Riya", nullable=False)
    voice_persona: Mapped[str] = mapped_column(String(40), default="NEHA", nullable=False)
    language: Mapped[str] = mapped_column(String(30), default="ENGLISH", nullable=False)
    talking_points: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    status: Mapped[str] = mapped_column(
        String(30), default=OutreachStatus.QUEUED, nullable=False, index=True
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="outreaches")
    candidate: Mapped[Candidate] = relationship(back_populates="outreaches")
    conversation: Mapped[Conversation | None] = relationship()
    voice_call: Mapped[VoiceCall | None] = relationship()
    response: Mapped[CandidateResponse | None] = relationship(
        back_populates="outreach", cascade="all, delete-orphan", uselist=False
    )


class CandidateResponse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Structured answers extracted from an outreach conversation.

    Mirrors the `result_schema` we register with the Hunar agent, so a live call
    and a demo call populate exactly the same columns.
    """

    __tablename__ = "candidate_responses"

    outreach_id: Mapped[str] = mapped_column(
        ForeignKey("outreaches.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    interest_level: Mapped[str] = mapped_column(
        String(30), default=InterestLevel.UNKNOWN, nullable=False, index=True
    )
    current_role: Mapped[str | None] = mapped_column(String(180))
    current_company: Mapped[str | None] = mapped_column(String(180))
    experience_years: Mapped[float | None] = mapped_column(Float)
    current_location: Mapped[str | None] = mapped_column(String(160))
    notice_period_days: Mapped[int | None] = mapped_column(Integer)
    expected_compensation: Mapped[str | None] = mapped_column(String(120))
    relevant_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    availability: Mapped[str | None] = mapped_column(String(160))
    reason_for_interest: Mapped[str | None] = mapped_column(Text)
    open_to_relocate: Mapped[bool | None] = mapped_column()

    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_recommendation: Mapped[str] = mapped_column(
        String(30), default=OutreachRecommendation.PENDING, nullable=False
    )
    confidence: Mapped[float | None] = mapped_column(Float)
    # Raw provider `result` object, kept verbatim for traceability.
    raw_result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    outreach: Mapped[Outreach] = relationship(back_populates="response")
