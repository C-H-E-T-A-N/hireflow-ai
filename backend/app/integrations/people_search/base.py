"""People-search provider contract.

The rest of the application talks only to `PeopleSearchProvider`. Swapping in
People Data Labs, Apollo, Proxycurl or an internal ATS index is a matter of
adding one class and registering it in `factory.py` - no service, route or UI
change is required.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class PeopleSearchQuery:
    """Normalised search intent, usually derived from a parsed job description."""

    titles: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    locations: list[str] = field(default_factory=list)
    min_experience_years: float | None = None
    max_experience_years: float | None = None
    companies: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    limit: int = 25


@dataclass(slots=True)
class SourcedProfile:
    """A candidate profile as returned by a provider, before it is persisted."""

    provider: str
    provider_profile_id: str
    full_name: str
    headline: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    country: str | None = None
    experience_years: float | None = None
    skills: list[str] = field(default_factory=list)
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    avatar_url: str | None = None
    summary: str | None = None
    education: list[dict[str, Any]] = field(default_factory=list)
    experience: list[dict[str, Any]] = field(default_factory=list)
    availability_hint: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class PeopleSearchResult:
    provider: str
    # True only when the profiles came from a real external API call.
    is_live: bool
    total: int
    profiles: list[SourcedProfile]
    query_echo: dict[str, Any] = field(default_factory=dict)
    notice: str | None = None


class PeopleSearchProvider(Protocol):
    name: str
    is_live: bool

    def search(self, query: PeopleSearchQuery) -> PeopleSearchResult: ...
