from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.db.session import get_db
from app.integrations.hunar.service import voice_mode
from app.models.outreach import Outreach
from app.schemas.common import ListResponse
from app.schemas.voice import (
    CandidateResponseRead,
    ConversationRead,
    ConversationTurnRead,
    OutreachCreate,
    OutreachDetail,
    OutreachLiveState,
    OutreachRead,
)
from app.services import outreach_service

logger = get_logger(__name__)
router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.get("", response_model=ListResponse[OutreachDetail])
def list_outreach(
    status: str | None = Query(default=None),
    job_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ListResponse[OutreachDetail]:
    rows = outreach_service.list_outreaches(db, status=status, job_id=job_id, limit=limit)
    items = [OutreachDetail.model_validate(row) for row in rows]
    return ListResponse(items=items, total=len(items))


@router.post("", response_model=ListResponse[OutreachDetail], status_code=201)
def create_outreach(
    payload: OutreachCreate, db: Session = Depends(get_db)
) -> ListResponse[OutreachDetail]:
    """Queue an AI outreach batch, optionally dialling immediately."""
    created = outreach_service.create_outreach_batch(
        db,
        job_id=payload.job_id,
        candidate_ids=payload.candidate_ids,
        campaign_name=payload.campaign_name,
        agent_persona_name=payload.agent_persona_name,
        talking_points=payload.talking_points,
        language=payload.language,
    )

    if payload.start_immediately:
        for outreach in created:
            try:
                outreach_service.start_outreach(db, outreach.id)
            except Exception:  # noqa: BLE001 - one bad number must not fail the batch
                logger.warning("Could not start outreach %s", outreach.id, exc_info=True)

    items = [
        OutreachDetail.model_validate(outreach_service.get_outreach(db, row.id)) for row in created
    ]
    return ListResponse(items=items, total=len(items))


@router.get("/{outreach_id}", response_model=OutreachDetail)
def get_outreach(outreach_id: str, db: Session = Depends(get_db)) -> OutreachDetail:
    return OutreachDetail.model_validate(outreach_service.get_outreach(db, outreach_id))


@router.post("/{outreach_id}/start", response_model=OutreachRead)
def start_outreach(outreach_id: str, db: Session = Depends(get_db)) -> OutreachRead:
    return OutreachRead.model_validate(outreach_service.start_outreach(db, outreach_id))


@router.post("/{outreach_id}/complete", response_model=OutreachDetail)
def complete_outreach(outreach_id: str, db: Session = Depends(get_db)) -> OutreachDetail:
    """Fast-forward a demo call to its extracted result."""
    outreach = outreach_service.sync_outreach(db, outreach_id, force_complete=True)
    return OutreachDetail.model_validate(outreach)


@router.get("/{outreach_id}/live", response_model=OutreachLiveState)
def outreach_live_state(outreach_id: str, db: Session = Depends(get_db)) -> OutreachLiveState:
    outreach = outreach_service.sync_outreach(db, outreach_id)
    turns = outreach.conversation.turns if outreach.conversation else []

    elapsed = 0.0
    if outreach.started_at:
        end = outreach.completed_at or datetime.now(UTC)
        started = outreach.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=UTC)
        if end.tzinfo is None:
            end = end.replace(tzinfo=UTC)
        elapsed = max((end - started).total_seconds(), 0.0)

    return OutreachLiveState(
        id=outreach.id,
        status=outreach.status,
        elapsed_seconds=round(elapsed, 1),
        provider=outreach.voice_call.provider if outreach.voice_call else voice_mode(),
        call_status=outreach.voice_call.status if outreach.voice_call else None,
        turns=[ConversationTurnRead.model_validate(turn) for turn in turns],
        response=CandidateResponseRead.model_validate(outreach.response)
        if outreach.response
        else None,
    )


@router.get("/{outreach_id}/conversation", response_model=ConversationRead)
def outreach_conversation(outreach_id: str, db: Session = Depends(get_db)) -> ConversationRead:
    outreach = db.get(Outreach, outreach_id)
    if outreach is None or outreach.conversation is None:
        raise NotFoundError("No conversation has been recorded for this outreach yet.")
    return ConversationRead.model_validate(outreach.conversation)
