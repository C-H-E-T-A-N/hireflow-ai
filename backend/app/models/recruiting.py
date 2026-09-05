"""Core recruiting entities: users, jobs, candidates and job matches."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    AvailabilityStatus,
    CandidateSource,
    CandidateStage,
    EmploymentType,
    JobStatus,
)

if TYPE_CHECKING:
    from app.models.interview import Interview
    from app.models.outreach import Outreach


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A recruiter using the platform."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[str] = mapped_column(String(60), default="recruiter", nullable=False)
    company: Mapped[str | None] = mapped_column(String(160))
    avatar_url: Mapped[str | None] = mapped_column(String(512))

    jobs: Mapped[list[Job]] = relationship(back_populates="owner")


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "jobs"

    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    department: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(160))
    employment_type: Mapped[str] = mapped_column(
        String(40), default=EmploymentType.FULL_TIME, nullable=False
    )
    status: Mapped[str] = mapped_column(String(40), default=JobStatus.OPEN, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Structured requirements produced by the JD parser.
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    nice_to_have_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    min_experience_years: Mapped[float | None] = mapped_column(Float)
    max_experience_years: Mapped[float | None] = mapped_column(Float)
    seniority: Mapped[str | None] = mapped_column(String(60))
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    salary_currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    parsed_requirements: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    owner: Mapped[User | None] = relationship(back_populates="jobs")

    matches: Mapped[list[JobMatch]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    interviews: Mapped[list[Interview]] = relationship(back_populates="job")
    outreaches: Mapped[list[Outreach]] = relationship(back_populates="job")


class Candidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "candidates"

    full_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    headline: Mapped[str | None] = mapped_column(String(220))
    current_title: Mapped[str | None] = mapped_column(String(160))
    current_company: Mapped[str | None] = mapped_column(String(160))
    location: Mapped[str | None] = mapped_column(String(160))
    country: Mapped[str | None] = mapped_column(String(80))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    linkedin_url: Mapped[str | None] = mapped_column(String(512))
    github_url: Mapped[str | None] = mapped_column(String(512))

    experience_years: Mapped[float | None] = mapped_column(Float)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    education: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    experience: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)

    stage: Mapped[str] = mapped_column(
        String(40), default=CandidateStage.SOURCED, nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(
        String(40), default=CandidateSource.PEOPLE_SEARCH, nullable=False
    )
    # Which provider produced this profile, plus the provider-side identifier.
    source_provider: Mapped[str | None] = mapped_column(String(60))
    source_profile_id: Mapped[str | None] = mapped_column(String(160), index=True)

    availability: Mapped[str] = mapped_column(
        String(40), default=AvailabilityStatus.UNKNOWN, nullable=False
    )
    notice_period_days: Mapped[int | None] = mapped_column(Integer)
    expected_ctc: Mapped[str | None] = mapped_column(String(80))
    current_ctc: Mapped[str | None] = mapped_column(String(80))

    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    matches: Mapped[list[JobMatch]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan"
    )
    interviews: Mapped[list[Interview]] = relationship(back_populates="candidate")
    outreaches: Mapped[list[Outreach]] = relationship(back_populates="candidate")
    insights: Mapped[list[AIInsight]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan"
    )


class JobMatch(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Explainable fit score between one candidate and one job."""

    __tablename__ = "job_matches"

    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[str] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )

    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    skill_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    experience_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    location_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    matched_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="matches")
    candidate: Mapped[Candidate] = relationship(back_populates="matches")


class AIInsight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A surfaced, actionable observation shown on the dashboard."""

    __tablename__ = "ai_insights"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="info", nullable=False)
    action_label: Mapped[str | None] = mapped_column(String(80))
    action_href: Mapped[str | None] = mapped_column(String(300))
    candidate_id: Mapped[str | None] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[str | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidate: Mapped[Candidate | None] = relationship(back_populates="insights")


class Activity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only feed of everything that happens in the workspace."""

    __tablename__ = "activities"

    type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(String(120), default="HireFlow AI", nullable=False)
    candidate_id: Mapped[str | None] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[str | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
