"""Mock people-search provider.

NO EXTERNAL API IS CALLED. This provider filters and ranks a fabricated local
dataset so the sourcing workflow can be demonstrated without a paid data vendor.
Results are returned with `is_live=False` and a provider name of "mock", which
the API and UI surface verbatim - the product never claims a real search ran.
"""

from __future__ import annotations

import hashlib

from app.core.logging import get_logger
from app.integrations.people_search.base import (
    PeopleSearchQuery,
    PeopleSearchResult,
    SourcedProfile,
)
from app.integrations.people_search.mock_dataset import MOCK_PROFILES

logger = get_logger(__name__)

NOTICE = (
    "Results come from the built-in mock dataset. No external people-search API "
    "was called. Set PEOPLE_SEARCH_PROVIDER=pdl with a PDL_API_KEY for live data."
)


class MockPeopleSearchProvider:
    name = "mock"
    is_live = False

    def search(self, query: PeopleSearchQuery) -> PeopleSearchResult:
        wanted_skills = {skill.lower() for skill in query.skills}
        wanted_titles = [title.lower() for title in query.titles]
        wanted_locations = [loc.lower() for loc in query.locations]

        scored: list[tuple[float, dict]] = []
        for record in MOCK_PROFILES:
            score = _relevance(record, wanted_skills, wanted_titles, wanted_locations, query)
            if score <= 0:
                continue
            scored.append((score, record))

        scored.sort(key=lambda item: item[0], reverse=True)
        selected = scored[: query.limit]

        logger.info(
            "Mock people search matched %s of %s profiles", len(selected), len(MOCK_PROFILES)
        )
        return PeopleSearchResult(
            provider=self.name,
            is_live=False,
            total=len(scored),
            profiles=[_to_profile(record) for _, record in selected],
            query_echo={
                "titles": query.titles,
                "skills": query.skills,
                "locations": query.locations,
                "min_experience_years": query.min_experience_years,
                "max_experience_years": query.max_experience_years,
            },
            notice=NOTICE,
        )


def _relevance(
    record: dict,
    wanted_skills: set[str],
    wanted_titles: list[str],
    wanted_locations: list[str],
    query: PeopleSearchQuery,
) -> float:
    """Simple, explainable relevance: skills dominate, then title, then location."""
    score = 1.0  # everyone starts eligible so an empty query returns the pool

    record_skills = {skill.lower() for skill in record["skills"]}
    if wanted_skills:
        overlap = len(wanted_skills & record_skills)
        if overlap == 0:
            return 0.0
        score += (overlap / len(wanted_skills)) * 60

    title = record["current_title"].lower()
    if wanted_titles:
        if any(_title_overlap(title, wanted) for wanted in wanted_titles):
            score += 20

    location = record["location"].lower()
    if wanted_locations:
        if any(_location_matches(location, wanted) for wanted in wanted_locations):
            score += 15
        else:
            score -= 5

    years = float(record["experience_years"])
    if query.min_experience_years is not None:
        if years < query.min_experience_years:
            return 0.0
        score += 5
    if query.max_experience_years is not None and years > query.max_experience_years + 2:
        score -= 8

    if query.keywords:
        blob = f"{record['summary']} {record['current_company']}".lower()
        score += sum(3 for keyword in query.keywords if keyword.lower() in blob)

    return max(score, 0.0)


def _title_overlap(title: str, wanted: str) -> bool:
    stop = {"senior", "junior", "lead", "staff", "ii", "iii", "engineer", "developer"}
    tokens = {token for token in wanted.split() if token not in stop and len(token) > 2}
    if not tokens:
        return any(word in title for word in wanted.split())
    return any(token in title for token in tokens)


def _location_matches(location: str, wanted: str) -> bool:
    if "remote" in wanted or "remote" in location:
        return True
    parts = [part.strip() for part in wanted.replace("/", ",").split(",") if part.strip()]
    return any(part in location for part in parts)


def _to_profile(record: dict) -> SourcedProfile:
    slug = record["full_name"].lower().replace(" ", ".")
    digest = hashlib.sha256(record["id"].encode()).hexdigest()[:10]
    return SourcedProfile(
        provider="mock",
        provider_profile_id=record["id"],
        full_name=record["full_name"],
        headline=f"{record['current_title']} at {record['current_company']}",
        current_title=record["current_title"],
        current_company=record["current_company"],
        location=record["location"],
        country=record.get("country"),
        experience_years=record["experience_years"],
        skills=list(record["skills"]),
        # Fabricated contact details. The +91 99999 range is reserved for test use.
        email=f"{slug}@example.com",
        phone=f"+9199999{digest[:5]}",
        linkedin_url=f"https://www.linkedin.com/in/{slug}-{digest[:6]}",
        github_url=None,
        avatar_url=None,
        summary=record.get("summary"),
        education=record.get("education", []),
        experience=record.get("experience", []),
        availability_hint=record.get("availability_hint"),
        raw={"source": "mock_dataset", "simulated": True, **record},
    )
