"""AI interview configuration, execution and evaluation."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    InterviewDifficulty,
    InterviewStatus,
    InterviewType,
    Recommendation,
)

if TYPE_CHECKING:
    from app.models.conversation import Conversation, VoiceCall
    from app.models.recruiting import Candidate, Job


class Interview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interviews"

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

    # --- Configuration -------------------------------------------------------
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    interview_type: Mapped[str] = mapped_column(
        String(40), default=InterviewType.TECHNICAL, nullable=False
    )
    difficulty: Mapped[str] = mapped_column(
        String(30), default=InterviewDifficulty.INTERMEDIATE, nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    focus_areas: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    language: Mapped[str] = mapped_column(String(30), default="ENGLISH", nullable=False)
    agent_persona_name: Mapped[str] = mapped_column(String(80), default="Aria", nullable=False)
    voice_persona: Mapped[str] = mapped_column(String(40), default="NEHA", nullable=False)
    intro_message: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    # --- Execution -----------------------------------------------------------
    status: Mapped[str] = mapped_column(
        String(30), default=InterviewStatus.DRAFT, nullable=False, index=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_question_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)

    # --- Evaluation ----------------------------------------------------------
    overall_score: Mapped[float | None] = mapped_column(Float)
    technical_score: Mapped[float | None] = mapped_column(Float)
    communication_score: Mapped[float | None] = mapped_column(Float)
    problem_solving_score: Mapped[float | None] = mapped_column(Float)
    role_fit_score: Mapped[float | None] = mapped_column(Float)
    recommendation: Mapped[str] = mapped_column(
        String(30), default=Recommendation.PENDING, nullable=False
    )
    evaluation_summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    concerns: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    evaluation_detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    job: Mapped[Job] = relationship(back_populates="interviews")
    candidate: Mapped[Candidate] = relationship(back_populates="interviews")
    conversation: Mapped[Conversation | None] = relationship()
    voice_call: Mapped[VoiceCall | None] = relationship()
    questions: Mapped[list[InterviewQuestion]] = relationship(
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewQuestion.sequence",
    )


class InterviewQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interview_questions"

    interview_id: Mapped[str] = mapped_column(
        ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    focus_area: Mapped[str | None] = mapped_column(String(80))
    competency: Mapped[str | None] = mapped_column(String(80))
    expected_signals: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    interview: Mapped[Interview] = relationship(back_populates="questions")
    answer: Mapped[InterviewAnswer | None] = relationship(
        back_populates="question", cascade="all, delete-orphan", uselist=False
    )


class InterviewAnswer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interview_answers"

    question_id: Mapped[str] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    transcript: Mapped[str] = mapped_column(Text, default="", nullable=False)
    score: Mapped[float | None] = mapped_column(Float)
    signals_detected: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    assessment: Mapped[str | None] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    question: Mapped[InterviewQuestion] = relationship(back_populates="answer")
