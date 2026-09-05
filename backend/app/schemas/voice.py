from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import InterviewDifficulty, InterviewType
from app.schemas.common import ORMModel
from app.schemas.recruiting import CandidateListItem, JobSummary

# --- Conversations ------------------------------------------------------------


class ConversationTurnRead(ORMModel):
    id: str
    sequence: int
    speaker: str
    content: str
    offset_seconds: float | None
    meta: dict[str, Any]


class VoiceCallRead(ORMModel):
    id: str
    provider: str
    provider_call_id: str | None
    status: str
    lifecycle_status: str
    recording_url: str | None
    duration_seconds: float | None
    answered_by: str | None
    engagement_status: str | None
    started_at: datetime | None
    ended_at: datetime | None
    error_message: str | None


class ConversationRead(ORMModel):
    id: str
    channel: str
    status: str
    title: str | None
    candidate_id: str | None
    job_id: str | None
    summary: str | None
    sentiment: str | None
    extracted_data: dict[str, Any]
    created_at: datetime
    turns: list[ConversationTurnRead] = []
    voice_call: VoiceCallRead | None = None


class ConversationListItem(ORMModel):
    id: str
    channel: str
    status: str
    title: str | None
    candidate_id: str | None
    summary: str | None
    sentiment: str | None
    created_at: datetime
    turn_count: int = 0


# --- Interviews ---------------------------------------------------------------


class InterviewCreate(BaseModel):
    job_id: str
    candidate_id: str
    title: str | None = None
    interview_type: InterviewType = InterviewType.TECHNICAL
    difficulty: InterviewDifficulty = InterviewDifficulty.INTERMEDIATE
    duration_minutes: int = Field(default=30, ge=10, le=90)
    focus_areas: list[str] = []
    language: str = "ENGLISH"
    agent_persona_name: str = "Aria"
    scheduled_at: datetime | None = None
    notes: str | None = None


class InterviewAnswerRead(ORMModel):
    id: str
    transcript: str
    score: float | None
    signals_detected: list[str]
    assessment: str | None
    answered_at: datetime | None


class InterviewQuestionRead(ORMModel):
    id: str
    sequence: int
    prompt: str
    focus_area: str | None
    competency: str | None
    expected_signals: list[str]
    weight: float
    answer: InterviewAnswerRead | None = None


class InterviewRead(ORMModel):
    id: str
    job_id: str
    candidate_id: str
    conversation_id: str | None
    title: str
    interview_type: str
    difficulty: str
    duration_minutes: int
    focus_areas: list[str]
    language: str
    agent_persona_name: str
    voice_persona: str
    intro_message: str | None
    notes: str | None
    status: str
    scheduled_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    current_question_index: int
    error_message: str | None
    overall_score: float | None
    technical_score: float | None
    communication_score: float | None
    problem_solving_score: float | None
    role_fit_score: float | None
    recommendation: str
    evaluation_summary: str | None
    strengths: list[str]
    concerns: list[str]
    evaluation_detail: dict[str, Any]
    created_at: datetime


class InterviewDetail(InterviewRead):
    candidate: CandidateListItem | None = None
    job: JobSummary | None = None
    questions: list[InterviewQuestionRead] = []
    voice_call: VoiceCallRead | None = None


class InterviewListItem(ORMModel):
    id: str
    title: str
    status: str
    interview_type: str
    difficulty: str
    duration_minutes: int
    overall_score: float | None
    recommendation: str
    scheduled_at: datetime | None
    created_at: datetime
    candidate: CandidateListItem | None = None
    job: JobSummary | None = None


class InterviewLiveState(BaseModel):
    """Small, poll-friendly payload for the live interview room."""

    id: str
    status: str
    elapsed_seconds: float
    current_question_index: int
    total_questions: int
    current_question: str | None
    provider: str
    call_status: str | None
    turns: list[ConversationTurnRead]
    overall_score: float | None = None
    recommendation: str | None = None


# --- Outreach -----------------------------------------------------------------


class OutreachCreate(BaseModel):
    job_id: str
    candidate_ids: list[str] = Field(min_length=1)
    campaign_name: str | None = None
    agent_persona_name: str = "Riya"
    talking_points: list[str] = []
    language: str = "ENGLISH"
    # Place the calls immediately after queueing them.
    start_immediately: bool = True


class CandidateResponseRead(ORMModel):
    id: str
    interest_level: str
    current_role: str | None
    current_company: str | None
    experience_years: float | None
    current_location: str | None
    notice_period_days: int | None
    expected_compensation: str | None
    relevant_skills: list[str]
    availability: str | None
    reason_for_interest: str | None
    open_to_relocate: bool | None
    ai_summary: str | None
    ai_recommendation: str
    confidence: float | None


class OutreachRead(ORMModel):
    id: str
    job_id: str
    candidate_id: str
    conversation_id: str | None
    campaign_name: str | None
    agent_persona_name: str
    language: str
    talking_points: list[str]
    status: str
    attempt_count: int
    queued_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    response: CandidateResponseRead | None = None


class OutreachDetail(OutreachRead):
    candidate: CandidateListItem | None = None
    job: JobSummary | None = None
    voice_call: VoiceCallRead | None = None


class OutreachLiveState(BaseModel):
    id: str
    status: str
    elapsed_seconds: float
    provider: str
    call_status: str | None
    turns: list[ConversationTurnRead]
    response: CandidateResponseRead | None = None
