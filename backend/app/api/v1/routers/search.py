"""People search and candidate sourcing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import ValidationError
from app.db.session import get_db
from app.integrations.people_search.base import PeopleSearchQuery
from app.models.recruiting import Job
from app.schemas.common import ListResponse
from app.schemas.recruiting import (
    CandidateListItem,
    MatchPreview,
    ParsedRequirements,
    PeopleSearchRequest,
    PeopleSearchResponse,
    SaveProfilesRequest,
    SourcedProfileRead,
)
from app.services import job_service, sourcing_service

router = APIRouter(prefix="/search", tags=["people-search"])


@router.post("/candidates", response_model=PeopleSearchResponse)
def search_candidates(
    payload: PeopleSearchRequest, db: Session = Depends(get_db)
) -> PeopleSearchResponse:
    """Search a people-search provider for profiles matching a job or ad-hoc criteria."""
    job: Job | None = None
    parsed: ParsedRequirements | None = None

    if payload.job_id:
        job = job_service.get_job(db, payload.job_id)
        query = sourcing_service.build_query_from_job(job, limit=payload.limit)
        if job.parsed_requirements:
            parsed = ParsedRequirements(**job.parsed_requirements)
    elif payload.description:
        parsed_jd = job_service.parse_job_description(payload.description)
        parsed = ParsedRequirements(**parsed_jd.to_dict())
        query = PeopleSearchQuery(
            titles=[parsed_jd.title] if parsed_jd.title else [],
            skills=parsed_jd.required_skills,
            locations=parsed_jd.locations,
            min_experience_years=parsed_jd.min_experience_years,
            max_experience_years=parsed_jd.max_experience_years,
            keywords=parsed_jd.keywords,
            limit=payload.limit,
        )
    else:
        if not (payload.skills or payload.titles or payload.locations):
            raise ValidationError(
                "Provide a job_id, a job description, or at least one of titles/skills/locations."
            )
        query = PeopleSearchQuery(
            titles=payload.titles,
            skills=payload.skills,
            locations=payload.locations,
            min_experience_years=payload.min_experience_years,
            max_experience_years=payload.max_experience_years,
            keywords=payload.keywords,
            limit=payload.limit,
        )

    # Explicit overrides always win over anything inferred from the JD.
    if payload.skills:
        query.skills = payload.skills
    if payload.locations:
        query.locations = payload.locations
    if payload.min_experience_years is not None:
        query.min_experience_years = payload.min_experience_years

    result, scored = sourcing_service.search_candidates(
        db, query=query, job=job, provider_name=payload.provider
    )

    return PeopleSearchResponse(
        provider=result.provider,
        is_live=result.is_live,
        total=result.total,
        notice=result.notice,
        parsed_requirements=parsed,
        results=[
            SourcedProfileRead(
                provider=item.profile.provider,
                provider_profile_id=item.profile.provider_profile_id,
                full_name=item.profile.full_name,
                headline=item.profile.headline,
                current_title=item.profile.current_title,
                current_company=item.profile.current_company,
                location=item.profile.location,
                country=item.profile.country,
                experience_years=item.profile.experience_years,
                skills=item.profile.skills,
                email=item.profile.email,
                phone=item.profile.phone,
                linkedin_url=item.profile.linkedin_url,
                github_url=item.profile.github_url,
                summary=item.profile.summary,
                education=item.profile.education,
                experience=item.profile.experience,
                availability_hint=item.profile.availability_hint,
                candidate_id=item.candidate_id,
                match=MatchPreview(
                    score=item.match.score,
                    skill_score=item.match.skill_score,
                    experience_score=item.match.experience_score,
                    location_score=item.match.location_score,
                    matched_skills=item.match.matched_skills,
                    missing_skills=item.match.missing_skills,
                    rationale=item.match.rationale,
                )
                if item.match
                else None,
            )
            for item in scored
        ],
    )


@router.post("/save", response_model=ListResponse[CandidateListItem], status_code=201)
def save_profiles(
    payload: SaveProfilesRequest, db: Session = Depends(get_db)
) -> ListResponse[CandidateListItem]:
    """Move selected search results into the candidate pool."""
    candidates = sourcing_service.save_profiles(
        db, profiles=payload.profiles, job_id=payload.job_id
    )
    items = [CandidateListItem.model_validate(row) for row in candidates]
    return ListResponse(items=items, total=len(items))
