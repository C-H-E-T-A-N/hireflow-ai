from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations.llm.factory import active_llm_engine
from app.models.interview import Interview
from app.models.outreach import Outreach
from app.models.recruiting import JobMatch
from app.schemas.common import ListResponse
from app.schemas.recruiting import (
    JobCreate,
    JobRead,
    JobStats,
    JobUpdate,
    ParsedRequirements,
    ParseJDRequest,
)
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=ListResponse[JobStats])
def list_jobs(
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ListResponse[JobStats]:
    jobs = job_service.list_jobs(db, status=status, limit=limit)

    candidate_counts = dict(
        db.execute(select(JobMatch.job_id, func.count()).group_by(JobMatch.job_id)).all()
    )
    interview_counts = dict(
        db.execute(select(Interview.job_id, func.count()).group_by(Interview.job_id)).all()
    )
    outreach_counts = dict(
        db.execute(select(Outreach.job_id, func.count()).group_by(Outreach.job_id)).all()
    )

    items = [
        JobStats(
            **JobRead.model_validate(job).model_dump(),
            candidate_count=int(candidate_counts.get(job.id, 0)),
            interview_count=int(interview_counts.get(job.id, 0)),
            outreach_count=int(outreach_counts.get(job.id, 0)),
        )
        for job in jobs
    ]
    return ListResponse(items=items, total=len(items))


@router.post("", response_model=JobRead, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db)) -> JobRead:
    job = job_service.create_job(
        db,
        title=payload.title,
        description=payload.description,
        department=payload.department,
        location=payload.location,
        employment_type=payload.employment_type,
        status=payload.status,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
    )
    return JobRead.model_validate(job)


@router.post("/parse-description", response_model=ParsedRequirements)
def parse_description(payload: ParseJDRequest) -> ParsedRequirements:
    """Extract structured requirements from a pasted job description."""
    parsed = job_service.parse_job_description(payload.description)
    data = parsed.to_dict()
    data["engine"] = data.get("engine") or active_llm_engine()
    return ParsedRequirements(**data)


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobRead:
    return JobRead.model_validate(job_service.get_job(db, job_id))


@router.patch("/{job_id}", response_model=JobRead)
def update_job(job_id: str, payload: JobUpdate, db: Session = Depends(get_db)) -> JobRead:
    job = job_service.update_job(db, job_id, payload.model_dump(exclude_unset=True))
    return JobRead.model_validate(job)
