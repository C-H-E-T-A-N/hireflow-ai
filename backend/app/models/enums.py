"""Domain enumerations.

These are persisted as plain strings so that adding a value never requires a
PostgreSQL enum migration, and so the identical schema runs on SQLite locally.
"""

from __future__ import annotations

from enum import StrEnum


class JobStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    PAUSED = "paused"
    CLOSED = "closed"


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"


class CandidateStage(StrEnum):
    """Position in the hiring pipeline. Ordered, left to right."""

    SOURCED = "sourced"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_COMPLETED = "interview_completed"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    HIRED = "hired"


PIPELINE_ORDER: tuple[CandidateStage, ...] = (
    CandidateStage.SOURCED,
    CandidateStage.CONTACTED,
    CandidateStage.INTERESTED,
    CandidateStage.INTERVIEW_SCHEDULED,
    CandidateStage.INTERVIEW_COMPLETED,
    CandidateStage.SHORTLISTED,
    CandidateStage.HIRED,
)


class CandidateSource(StrEnum):
    PEOPLE_SEARCH = "people_search"
    REFERRAL = "referral"
    INBOUND = "inbound"
    IMPORTED = "imported"


class AvailabilityStatus(StrEnum):
    IMMEDIATE = "immediate"
    ONE_MONTH = "one_month"
    TWO_MONTHS = "two_months"
    THREE_MONTHS_PLUS = "three_months_plus"
    NOT_LOOKING = "not_looking"
    UNKNOWN = "unknown"


class InterviewStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    DIALING = "dialing"
    IN_PROGRESS = "in_progress"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class InterviewDifficulty(StrEnum):
    ENTRY = "entry"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class InterviewType(StrEnum):
    TECHNICAL = "technical"
    BEHAVIOURAL = "behavioural"
    SCREENING = "screening"
    CULTURE_FIT = "culture_fit"


class Recommendation(StrEnum):
    STRONG_HIRE = "strong_hire"
    SHORTLIST = "shortlist"
    CONSIDER = "consider"
    REJECT = "reject"
    PENDING = "pending"


class OutreachStatus(StrEnum):
    QUEUED = "queued"
    DIALING = "dialing"
    IN_PROGRESS = "in_progress"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NO_ANSWER = "no_answer"
    FAILED = "failed"
    CANCELLED = "cancelled"


class InterestLevel(StrEnum):
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    MAYBE_LATER = "maybe_later"
    UNKNOWN = "unknown"


class OutreachRecommendation(StrEnum):
    HIGH_POTENTIAL = "high_potential"
    WORTH_PURSUING = "worth_pursuing"
    NURTURE = "nurture"
    DISQUALIFY = "disqualify"
    PENDING = "pending"


class ConversationChannel(StrEnum):
    VOICE_INTERVIEW = "voice_interview"
    VOICE_OUTREACH = "voice_outreach"


class ConversationStatus(StrEnum):
    ACTIVE = "active"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class SpeakerRole(StrEnum):
    AGENT = "agent"
    CANDIDATE = "candidate"
    SYSTEM = "system"


class VoiceCallStatus(StrEnum):
    """Mirrors the Hunar call status vocabulary."""

    NOT_STARTED = "NOT_STARTED"
    SCHEDULED = "SCHEDULED"
    INITIATED = "INITIATED"
    RINGING = "RINGING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NOT_CONNECTED = "NOT_CONNECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


class VoiceProvider(StrEnum):
    HUNAR = "hunar"
    DEMO = "demo"


class ActivityType(StrEnum):
    JOB_CREATED = "job_created"
    CANDIDATE_SOURCED = "candidate_sourced"
    CANDIDATE_STAGE_CHANGED = "candidate_stage_changed"
    OUTREACH_STARTED = "outreach_started"
    OUTREACH_COMPLETED = "outreach_completed"
    INTERVIEW_CREATED = "interview_created"
    INTERVIEW_STARTED = "interview_started"
    INTERVIEW_COMPLETED = "interview_completed"
    INSIGHT_GENERATED = "insight_generated"


class InsightSeverity(StrEnum):
    POSITIVE = "positive"
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AttendanceStatus(StrEnum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"
    PENDING_REVIEW = "pending_review"


class AttendanceVerification(StrEnum):
    VOICEPRINT = "voiceprint"
    PIN = "pin"
    SUPERVISOR_OVERRIDE = "supervisor_override"
    FAILED = "failed"
