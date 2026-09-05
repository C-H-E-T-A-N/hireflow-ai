"""People Data Labs provider.

A real implementation of the `PeopleSearchProvider` protocol, included to prove
the abstraction holds for a live vendor. It is inactive unless
PEOPLE_SEARCH_PROVIDER=pdl and PDL_API_KEY are both set; the factory refuses to
return it otherwise rather than degrading silently.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import ConfigurationError, IntegrationError
from app.core.logging import get_logger
from app.integrations.people_search.base import (
    PeopleSearchQuery,
    PeopleSearchResult,
    SourcedProfile,
)

logger = get_logger(__name__)

PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search"


class PDLPeopleSearchProvider:
    name = "pdl"
    is_live = True

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.pdl_api_key

    def search(self, query: PeopleSearchQuery) -> PeopleSearchResult:
        if not self._api_key:
            raise ConfigurationError("PDL_API_KEY is not configured on the server.")

        sql = _build_sql(query)
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    PDL_SEARCH_URL,
                    headers={"X-Api-Key": self._api_key},
                    params={"sql": sql, "size": min(query.limit, 100), "pretty": "false"},
                )
        except httpx.HTTPError as exc:
            raise IntegrationError("Unable to reach the people-search provider.") from exc

        if response.status_code == 404:
            # PDL returns 404 when a valid query simply has no matches.
            return PeopleSearchResult(provider=self.name, is_live=True, total=0, profiles=[])
        if response.status_code >= 400:
            logger.warning("PDL search failed with %s", response.status_code)
            raise IntegrationError("The people-search provider rejected the query.")

        payload = response.json()
        records = payload.get("data", []) or []
        return PeopleSearchResult(
            provider=self.name,
            is_live=True,
            total=int(payload.get("total", len(records))),
            profiles=[_to_profile(record) for record in records],
            query_echo={"sql": sql},
        )


def _escape(value: str) -> str:
    return value.replace("'", "''")


def _build_sql(query: PeopleSearchQuery) -> str:
    clauses: list[str] = []
    if query.skills:
        skills = ", ".join(f"'{_escape(skill.lower())}'" for skill in query.skills)
        clauses.append(f"skills IN ({skills})")
    if query.titles:
        titles = " OR ".join(
            f"job_title LIKE '%{_escape(title.lower())}%'" for title in query.titles
        )
        clauses.append(f"({titles})")
    if query.locations:
        locations = ", ".join(f"'{_escape(loc.lower())}'" for loc in query.locations)
        clauses.append(f"location_locality IN ({locations})")
    if query.companies:
        companies = ", ".join(f"'{_escape(name.lower())}'" for name in query.companies)
        clauses.append(f"job_company_name IN ({companies})")
    if query.min_experience_years is not None:
        clauses.append(f"inferred_years_experience >= {int(query.min_experience_years)}")

    where = " AND ".join(clauses) if clauses else "1 = 1"
    return f"SELECT * FROM person WHERE {where}"


def _to_profile(record: dict[str, Any]) -> SourcedProfile:
    emails = record.get("emails") or []
    phones = record.get("phone_numbers") or []
    return SourcedProfile(
        provider="pdl",
        provider_profile_id=str(record.get("id") or record.get("linkedin_username") or ""),
        full_name=record.get("full_name") or "Unknown",
        headline=record.get("headline"),
        current_title=record.get("job_title"),
        current_company=record.get("job_company_name"),
        location=record.get("location_name"),
        country=record.get("location_country"),
        experience_years=record.get("inferred_years_experience"),
        skills=list(record.get("skills") or [])[:20],
        email=(emails[0].get("address") if isinstance(emails[0], dict) else emails[0])
        if emails
        else None,
        phone=phones[0] if phones else None,
        linkedin_url=record.get("linkedin_url"),
        github_url=record.get("github_url"),
        summary=record.get("summary"),
        education=[
            {
                "school": (item.get("school") or {}).get("name"),
                "degree": ", ".join(item.get("degrees") or []),
                "year": item.get("end_date"),
            }
            for item in (record.get("education") or [])[:3]
        ],
        experience=[
            {
                "title": (item.get("title") or {}).get("name"),
                "company": (item.get("company") or {}).get("name"),
                "start": item.get("start_date"),
                "end": item.get("end_date") or "Present",
            }
            for item in (record.get("experience") or [])[:5]
        ],
        raw=record,
    )
