from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.enums import ActivityType, CandidateSource, CandidateStage
from app.models.interview import Interview
from app.models.outreach import Outreach
from app.models.recruiting import Candidate, Job, JobMatch
from app.schemas.common import ListResponse
from app.schemas.recruiting import (
    CandidateCreate,
    CandidateListItem,
    CandidateRead,
    CandidateUpdate,
    MatchRead,
)
from app.schemas.voice import (
    ConversationListItem,
    InterviewListItem,
    OutreachRead,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=ListResponse[CandidateListItem])
def list_candidates(
    stage: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Free-text name/title/company search"),
    skill: list[str] | None = Query(default=None),
    location: str | None = Query(default=None),
    min_experience: float | None = Query(default=None, ge=0),
    job_id: str | None = Query(default=None, description="Score candidates against this job"),
    sort: str = Query(default="recent", pattern="^(recent|match|experience|name)$"),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ListResponse[CandidateListItem]:
    stmt = select(Candidate).where(Candidate.is_archived.is_(False))

    if stage:
        stmt = stmt.where(Candidate.stage == stage)
    if q:
        needle = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Candidate.full_name).like(needle),
                func.lower(Candidate.current_title).like(needle),
                func.lower(Candidate.current_company).like(needle),
            )
        )
    if location:
        stmt = stmt.where(func.lower(Candidate.location).like(f"%{location.lower()}%"))
    if min_experience is not None:
        stmt = stmt.where(Candidate.experience_years >= min_experience)

    rows = list(db.execute(stmt.limit(limit * 2)).scalars())

    if skill:
        wanted = {item.lower() for item in skill}
        rows = [row for row in rows if wanted & {s.lower() for s in (row.skills or [])}]

    scores = _match_scores(db, [row.id for row in rows], job_id=job_id)

    items = [
        CandidateListItem(
            **CandidateListItem.model_validate(row).model_dump(exclude={"match_score"}),
            match_score=scores.get(row.id),
        )
        for row in rows
    ]

    if sort == "match":
        items.sort(key=lambda item: item.match_score or 0, reverse=True)
    elif sort == "experience":
        items.sort(key=lambda item: item.experience_years or 0, reverse=True)
    elif sort == "name":
        items.sort(key=lambda item: item.full_name)
    else:
        items.sort(
            key=lambda item: item.last_activity_at or datetime.min.replace(tzinfo=UTC), reverse=True
        )

    return ListResponse(items=items[:limit], total=len(items))


def _match_scores(db: Session, candidate_ids: list[str], *, job_id: str | None) -> dict[str, float]:
    if not candidate_ids:
        return {}
    stmt = select(JobMatch.candidate_id, func.max(JobMatch.score)).where(
        JobMatch.candidate_id.in_(candidate_ids)
    )
    if job_id:
        stmt = stmt.where(JobMatch.job_id == job_id)
    return {
        row[0]: round(float(row[1]), 1)
        for row in db.execute(stmt.group_by(JobMatch.candidate_id)).all()
    }


@router.post("", response_model=CandidateRead, status_code=201)
def create_candidate(payload: CandidateCreate, db: Session = Depends(get_db)) -> CandidateRead:
    candidate = Candidate(
        **payload.model_dump(),
        stage=CandidateStage.SOURCED,
        source=CandidateSource.IMPORTED,
        source_provider="manual",
    )
    db.add(candidate)
    db.flush()
    log_activity(
        db,
        type=ActivityType.CANDIDATE_SOURCED,
        message=f"{candidate.full_name} added manually",
        actor="Recruiter",
        candidate_id=candidate.id,
    )
    db.commit()
    db.refresh(candidate)
    return CandidateRead.model_validate(candidate)


@router.get("/{candidate_id}", response_model=CandidateRead)
def get_candidate(candidate_id: str, db: Session = Depends(get_db)) -> CandidateRead:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise NotFoundError(f"Candidate {candidate_id} was not found.")
    return CandidateRead.model_validate(candidate)


@router.patch("/{candidate_id}", response_model=CandidateRead)
def update_candidate(
    candidate_id: str, payload: CandidateUpdate, db: Session = Depends(get_db)
) -> CandidateRead:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise NotFoundError(f"Candidate {candidate_id} was not found.")

    changes = payload.model_dump(exclude_unset=True)
    previous_stage = candidate.stage
    for key, value in changes.items():
        setattr(candidate, key, value)
    candidate.last_activity_at = datetime.now(UTC)

    if "stage" in changes and changes["stage"] != previous_stage:
        log_activity(
            db,
            type=ActivityType.CANDIDATE_STAGE_CHANGED,
            message=(
                f"{candidate.full_name} moved from {previous_stage.replace('_', ' ')} "
                f"to {str(changes['stage']).replace('_', ' ')}"
            ),
            actor="Recruiter",
            candidate_id=candidate.id,
        )

    db.commit()
    db.refresh(candidate)
    return CandidateRead.model_validate(candidate)


@router.get("/{candidate_id}/matches", response_model=ListResponse[MatchRead])
def candidate_matches(candidate_id: str, db: Session = Depends(get_db)) -> ListResponse[MatchRead]:
    rows = list(
        db.execute(
            select(JobMatch)
            .where(JobMatch.candidate_id == candidate_id)
            .order_by(JobMatch.score.desc())
        ).scalars()
    )
    return ListResponse(items=[MatchRead.model_validate(row) for row in rows], total=len(rows))


@router.get("/{candidate_id}/timeline")
def candidate_timeline(candidate_id: str, db: Session = Depends(get_db)) -> dict:
    """Everything that has happened with this candidate, for the profile page."""
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise NotFoundError(f"Candidate {candidate_id} was not found.")

    interviews = list(
        db.execute(
            select(Interview)
            .where(Interview.candidate_id == candidate_id)
            .order_by(Interview.created_at.desc())
        ).scalars()
    )
    outreaches = list(
        db.execute(
            select(Outreach)
            .where(Outreach.candidate_id == candidate_id)
            .order_by(Outreach.created_at.desc())
        ).scalars()
    )
    conversations = list(
        db.execute(
            select(Conversation)
            .where(Conversation.candidate_id == candidate_id)
            .order_by(Conversation.created_at.desc())
        ).scalars()
    )
    matches = list(
        db.execute(
            select(JobMatch)
            .where(JobMatch.candidate_id == candidate_id)
            .order_by(JobMatch.score.desc())
        ).scalars()
    )
    job_titles = dict(db.execute(select(Job.id, Job.title)).all())

    return {
        "interviews": [InterviewListItem.model_validate(row).model_dump() for row in interviews],
        "outreaches": [OutreachRead.model_validate(row).model_dump() for row in outreaches],
        "conversations": [
            ConversationListItem(
                **ConversationListItem.model_validate(row).model_dump(exclude={"turn_count"}),
                turn_count=len(row.turns),
            ).model_dump()
            for row in conversations
        ],
        "matches": [
            {**MatchRead.model_validate(row).model_dump(), "job_title": job_titles.get(row.job_id)}
            for row in matches
        ],
    }
