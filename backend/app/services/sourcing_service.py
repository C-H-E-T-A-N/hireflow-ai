"""Candidate sourcing: run a people search, score the results, persist selections."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.integrations.people_search.base import (
    PeopleSearchQuery,
    PeopleSearchResult,
    SourcedProfile,
)
from app.integrations.people_search.factory import get_people_search_provider
from app.models.enums import ActivityType, AvailabilityStatus, CandidateSource, CandidateStage
from app.models.recruiting import Candidate, Job, JobMatch
from app.services.activity import log_activity
from app.services.matching import MatchBreakdown, score_match


@dataclass(slots=True)
class ScoredProfile:
    profile: SourcedProfile
    match: MatchBreakdown | None
    # Set when this profile has already been saved into the candidate pool.
    candidate_id: str | None = None


def build_query_from_job(job: Job, *, limit: int = 25) -> PeopleSearchQuery:
    parsed = job.parsed_requirements or {}
    return PeopleSearchQuery(
        titles=[job.title] if job.title else [],
        skills=list(job.required_skills or []),
        locations=list(parsed.get("locations") or ([job.location] if job.location else [])),
        min_experience_years=job.min_experience_years,
        max_experience_years=job.max_experience_years,
        keywords=list(parsed.get("keywords") or []),
        limit=limit,
    )


def search_candidates(
    db: Session,
    *,
    query: PeopleSearchQuery,
    job: Job | None = None,
    provider_name: str | None = None,
) -> tuple[PeopleSearchResult, list[ScoredProfile]]:
    provider = get_people_search_provider(provider_name)
    result = provider.search(query)

    # Flag profiles already in the pool so the UI can offer "view" over "save".
    existing = {
        row.source_profile_id: row.id
        for row in db.execute(
            select(Candidate).where(
                Candidate.source_profile_id.in_(
                    [p.provider_profile_id for p in result.profiles] or [""]
                )
            )
        ).scalars()
    }

    scored: list[ScoredProfile] = []
    for profile in result.profiles:
        match = None
        if job is not None:
            match = score_match(
                candidate_skills=profile.skills,
                candidate_experience_years=profile.experience_years,
                candidate_location=profile.location,
                required_skills=list(job.required_skills or []),
                nice_to_have_skills=list(job.nice_to_have_skills or []),
                min_experience_years=job.min_experience_years,
                max_experience_years=job.max_experience_years,
                job_locations=(job.parsed_requirements or {}).get("locations")
                or ([job.location] if job.location else []),
            )
        scored.append(
            ScoredProfile(
                profile=profile,
                match=match,
                candidate_id=existing.get(profile.provider_profile_id),
            )
        )

    if job is not None:
        scored.sort(key=lambda item: item.match.score if item.match else 0, reverse=True)

    return result, scored


AVAILABILITY_MAP = {
    "immediate": AvailabilityStatus.IMMEDIATE,
    "one_month": AvailabilityStatus.ONE_MONTH,
    "two_months": AvailabilityStatus.TWO_MONTHS,
    "three_months_plus": AvailabilityStatus.THREE_MONTHS_PLUS,
    "not_looking": AvailabilityStatus.NOT_LOOKING,
}


def save_profiles(
    db: Session,
    *,
    profiles: list[dict[str, Any]],
    job_id: str | None = None,
) -> list[Candidate]:
    """Persist sourced profiles into the candidate pool, de-duplicating by provider id."""
    job = db.get(Job, job_id) if job_id else None
    if job_id and job is None:
        raise NotFoundError(f"Job {job_id} was not found.")

    saved: list[Candidate] = []
    for payload in profiles:
        provider_id = payload.get("provider_profile_id")
        candidate = None
        if provider_id:
            candidate = db.execute(
                select(Candidate).where(Candidate.source_profile_id == provider_id)
            ).scalar_one_or_none()

        if candidate is None:
            candidate = Candidate(
                full_name=payload.get("full_name") or "Unknown candidate",
                email=payload.get("email"),
                phone=payload.get("phone"),
                headline=payload.get("headline"),
                current_title=payload.get("current_title"),
                current_company=payload.get("current_company"),
                location=payload.get("location"),
                country=payload.get("country"),
                linkedin_url=payload.get("linkedin_url"),
                github_url=payload.get("github_url"),
                experience_years=payload.get("experience_years"),
                skills=payload.get("skills") or [],
                education=payload.get("education") or [],
                experience=payload.get("experience") or [],
                summary=payload.get("summary"),
                stage=CandidateStage.SOURCED,
                source=CandidateSource.PEOPLE_SEARCH,
                source_provider=payload.get("provider"),
                source_profile_id=provider_id,
                availability=AVAILABILITY_MAP.get(
                    payload.get("availability_hint") or "", AvailabilityStatus.UNKNOWN
                ),
            )
            db.add(candidate)
            db.flush()
            log_activity(
                db,
                type=ActivityType.CANDIDATE_SOURCED,
                message=f"{candidate.full_name} sourced via {payload.get('provider', 'search')}",
                candidate_id=candidate.id,
                job_id=job_id,
            )

        if job is not None:
            upsert_match(db, job=job, candidate=candidate)

        saved.append(candidate)

    db.commit()
    for candidate in saved:
        db.refresh(candidate)
    return saved


def upsert_match(db: Session, *, job: Job, candidate: Candidate) -> JobMatch:
    breakdown = score_match(
        candidate_skills=list(candidate.skills or []),
        candidate_experience_years=candidate.experience_years,
        candidate_location=candidate.location,
        required_skills=list(job.required_skills or []),
        nice_to_have_skills=list(job.nice_to_have_skills or []),
        min_experience_years=job.min_experience_years,
        max_experience_years=job.max_experience_years,
        job_locations=(job.parsed_requirements or {}).get("locations")
        or ([job.location] if job.location else []),
    )

    match = db.execute(
        select(JobMatch).where(JobMatch.job_id == job.id, JobMatch.candidate_id == candidate.id)
    ).scalar_one_or_none()

    if match is None:
        match = JobMatch(job_id=job.id, candidate_id=candidate.id)
        db.add(match)

    match.score = breakdown.score
    match.skill_score = breakdown.skill_score
    match.experience_score = breakdown.experience_score
    match.location_score = breakdown.location_score
    match.matched_skills = breakdown.matched_skills
    match.missing_skills = breakdown.missing_skills
    match.rationale = breakdown.rationale
    db.flush()
    return match


def best_match_for(db: Session, candidate_id: str) -> JobMatch | None:
    return db.execute(
        select(JobMatch)
        .where(JobMatch.candidate_id == candidate_id)
        .order_by(JobMatch.score.desc())
        .limit(1)
    ).scalar_one_or_none()
