from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.integrations.llm.base import ParsedJobDescription
from app.integrations.llm.factory import get_llm_provider
from app.models.enums import ActivityType
from app.models.recruiting import Job
from app.services.activity import log_activity


def parse_job_description(text: str) -> ParsedJobDescription:
    """Extract structured requirements from free-text JD."""
    return get_llm_provider().parse_job_description(text)


def get_job(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} was not found.")
    return job


def list_jobs(db: Session, *, status: str | None = None, limit: int = 100) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Job.status == status)
    return list(db.execute(stmt).scalars())


def create_job(
    db: Session,
    *,
    title: str,
    description: str,
    department: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
    status: str | None = None,
    salary_min: int | None = None,
    salary_max: int | None = None,
    salary_currency: str = "INR",
    auto_parse: bool = True,
) -> Job:
    """Create a job, parsing the description into structured requirements."""
    parsed: ParsedJobDescription | None = None
    if auto_parse and description.strip():
        parsed = parse_job_description(description)

    job = Job(
        title=title,
        description=description,
        department=department,
        location=location or (parsed.locations[0] if parsed and parsed.locations else None),
        employment_type=employment_type
        or (parsed.employment_type if parsed and parsed.employment_type else "full_time"),
        status=status or "open",
        salary_min=salary_min,
        salary_max=salary_max,
        salary_currency=salary_currency,
        required_skills=parsed.required_skills if parsed else [],
        nice_to_have_skills=parsed.nice_to_have_skills if parsed else [],
        min_experience_years=parsed.min_experience_years if parsed else None,
        max_experience_years=parsed.max_experience_years if parsed else None,
        seniority=parsed.seniority if parsed else None,
        parsed_requirements=parsed.to_dict() if parsed else {},
    )
    db.add(job)
    db.flush()

    log_activity(
        db,
        type=ActivityType.JOB_CREATED,
        message=f"Job opened: {job.title}",
        actor="Recruiter",
        job_id=job.id,
    )
    db.commit()
    db.refresh(job)
    return job


def update_job(db: Session, job_id: str, changes: dict) -> Job:
    job = get_job(db, job_id)
    reparse = "description" in changes and changes["description"] != job.description

    for key, value in changes.items():
        if value is not None and hasattr(job, key):
            setattr(job, key, value)

    if reparse and job.description.strip():
        parsed = parse_job_description(job.description)
        job.required_skills = parsed.required_skills
        job.nice_to_have_skills = parsed.nice_to_have_skills
        job.min_experience_years = parsed.min_experience_years
        job.max_experience_years = parsed.max_experience_years
        job.seniority = parsed.seniority
        job.parsed_requirements = parsed.to_dict()

    db.commit()
    db.refresh(job)
    return job


def job_locations(job: Job) -> list[str]:
    """Locations to match against, preferring the parsed set."""
    parsed = job.parsed_requirements.get("locations") if job.parsed_requirements else None
    if parsed:
        return list(parsed)
    return [job.location] if job.location else []
