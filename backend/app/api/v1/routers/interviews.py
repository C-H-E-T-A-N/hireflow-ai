from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.session import get_db
from app.integrations.hunar.service import voice_mode
from app.models.interview import Interview
from app.schemas.common import ListResponse
from app.schemas.voice import (
    ConversationRead,
    ConversationTurnRead,
    InterviewCreate,
    InterviewDetail,
    InterviewListItem,
    InterviewLiveState,
    InterviewRead,
)
from app.services import interview_service
from app.services.question_bank import AVAILABLE_FOCUS_AREAS

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.get("", response_model=ListResponse[InterviewListItem])
def list_interviews(
    status: str | None = Query(default=None),
    job_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ListResponse[InterviewListItem]:
    rows = interview_service.list_interviews(db, status=status, job_id=job_id, limit=limit)
    items = [InterviewListItem.model_validate(row) for row in rows]
    return ListResponse(items=items, total=len(items))


@router.get("/focus-areas", response_model=list[str])
def focus_areas() -> list[str]:
    """Focus areas the question bank can generate a structured interview for."""
    return AVAILABLE_FOCUS_AREAS


@router.post("", response_model=InterviewDetail, status_code=201)
def create_interview(payload: InterviewCreate, db: Session = Depends(get_db)) -> InterviewDetail:
    interview = interview_service.create_interview(
        db,
        job_id=payload.job_id,
        candidate_id=payload.candidate_id,
        title=payload.title,
        interview_type=payload.interview_type,
        difficulty=payload.difficulty,
        duration_minutes=payload.duration_minutes,
        focus_areas=payload.focus_areas,
        language=payload.language,
        agent_persona_name=payload.agent_persona_name,
        scheduled_at=payload.scheduled_at,
        notes=payload.notes,
    )
    return InterviewDetail.model_validate(interview)


@router.get("/{interview_id}", response_model=InterviewDetail)
def get_interview(interview_id: str, db: Session = Depends(get_db)) -> InterviewDetail:
    return InterviewDetail.model_validate(interview_service.get_interview(db, interview_id))


@router.post("/{interview_id}/start", response_model=InterviewRead)
def start_interview(interview_id: str, db: Session = Depends(get_db)) -> InterviewRead:
    """Place the AI interview call (live via Hunar, or simulated in demo mode)."""
    return InterviewRead.model_validate(interview_service.start_interview(db, interview_id))


@router.post("/{interview_id}/complete", response_model=InterviewDetail)
def complete_interview(interview_id: str, db: Session = Depends(get_db)) -> InterviewDetail:
    """Fast-forward a running interview to its evaluated result.

    In demo mode this skips the simulated wait. Against a live call it simply
    re-reads the provider state, which is a no-op until the call actually ends.
    """
    interview = interview_service.sync_interview(db, interview_id, force_complete=True)
    return InterviewDetail.model_validate(interview)


@router.get("/{interview_id}/live", response_model=InterviewLiveState)
def interview_live_state(interview_id: str, db: Session = Depends(get_db)) -> InterviewLiveState:
    """Poll-friendly snapshot driving the live interview room."""
    interview = interview_service.sync_interview(db, interview_id)
    turns = interview.conversation.turns if interview.conversation else []
    questions = interview.questions

    elapsed = 0.0
    if interview.started_at:
        end = interview.completed_at or datetime.now(UTC)
        started = interview.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=UTC)
        if end.tzinfo is None:
            end = end.replace(tzinfo=UTC)
        elapsed = max((end - started).total_seconds(), 0.0)

    current = None
    if questions and interview.current_question_index < len(questions):
        current = questions[interview.current_question_index].prompt

    return InterviewLiveState(
        id=interview.id,
        status=interview.status,
        elapsed_seconds=round(elapsed, 1),
        current_question_index=interview.current_question_index,
        total_questions=len(questions),
        current_question=current,
        provider=interview.voice_call.provider if interview.voice_call else voice_mode(),
        call_status=interview.voice_call.status if interview.voice_call else None,
        turns=[ConversationTurnRead.model_validate(turn) for turn in turns],
        overall_score=interview.overall_score,
        recommendation=interview.recommendation,
    )


@router.get("/{interview_id}/conversation", response_model=ConversationRead)
def interview_conversation(interview_id: str, db: Session = Depends(get_db)) -> ConversationRead:
    interview = db.get(Interview, interview_id)
    if interview is None or interview.conversation is None:
        raise NotFoundError("No conversation has been recorded for this interview yet.")
    return ConversationRead.model_validate(interview.conversation)
