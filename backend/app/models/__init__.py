"""ORM models. Importing this package registers every table on `Base.metadata`."""

from app.db.base import Base
from app.models.attendance import AttendanceEvent, AuditLog, Employee, Location
from app.models.conversation import Conversation, ConversationTurn, VoiceCall
from app.models.interview import Interview, InterviewAnswer, InterviewQuestion
from app.models.outreach import CandidateResponse, Outreach
from app.models.recruiting import (
    Activity,
    AIInsight,
    Candidate,
    Job,
    JobMatch,
    User,
)

__all__ = [
    "Base",
    "Activity",
    "AIInsight",
    "AttendanceEvent",
    "AuditLog",
    "Candidate",
    "CandidateResponse",
    "Conversation",
    "ConversationTurn",
    "Employee",
    "Interview",
    "InterviewAnswer",
    "InterviewQuestion",
    "Job",
    "JobMatch",
    "Location",
    "Outreach",
    "User",
    "VoiceCall",
]
