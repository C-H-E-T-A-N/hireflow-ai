"""LLM provider contract for the three places HireFlow reasons over text.

The default provider is deterministic and needs no API key, so the product is
fully functional offline. Setting LLM_PROVIDER=anthropic upgrades the same three
calls to a real model without touching any calling code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class ParsedJobDescription:
    title: str | None = None
    seniority: str | None = None
    employment_type: str | None = None
    required_skills: list[str] = field(default_factory=list)
    nice_to_have_skills: list[str] = field(default_factory=list)
    min_experience_years: float | None = None
    max_experience_years: float | None = None
    locations: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    summary: str | None = None
    # Which engine produced this, surfaced in the UI.
    engine: str = "heuristic"

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "seniority": self.seniority,
            "employment_type": self.employment_type,
            "required_skills": self.required_skills,
            "nice_to_have_skills": self.nice_to_have_skills,
            "min_experience_years": self.min_experience_years,
            "max_experience_years": self.max_experience_years,
            "locations": self.locations,
            "responsibilities": self.responsibilities,
            "keywords": self.keywords,
            "summary": self.summary,
            "engine": self.engine,
        }


class LLMProvider(Protocol):
    name: str

    def parse_job_description(self, text: str) -> ParsedJobDescription: ...

    def summarise_conversation(self, context: dict[str, Any]) -> dict[str, Any]:
        """Return {"summary": str, "sentiment": str, "recommendation": str}."""
        ...

    def evaluate_interview(self, context: dict[str, Any]) -> dict[str, Any]:
        """Return the interview scorecard keys defined in INTERVIEW_RESULT_SCHEMA."""
        ...
