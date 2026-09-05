"""Explainable candidate/job match scoring.

Deliberately transparent rather than a black box: recruiters see exactly which
skills matched, which are missing, and how experience and location contributed.
"""

from __future__ import annotations

from dataclasses import dataclass

SKILL_WEIGHT = 0.60
EXPERIENCE_WEIGHT = 0.25
LOCATION_WEIGHT = 0.15


@dataclass(slots=True)
class MatchBreakdown:
    score: float
    skill_score: float
    experience_score: float
    location_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    rationale: str


def _normalise(value: str) -> str:
    return value.strip().lower().replace(".js", "js").replace(" ", "")


def score_match(
    *,
    candidate_skills: list[str],
    candidate_experience_years: float | None,
    candidate_location: str | None,
    required_skills: list[str],
    nice_to_have_skills: list[str] | None = None,
    min_experience_years: float | None = None,
    max_experience_years: float | None = None,
    job_locations: list[str] | None = None,
) -> MatchBreakdown:
    nice_to_have = nice_to_have_skills or []
    locations = job_locations or []

    candidate_index = {_normalise(skill): skill for skill in candidate_skills}

    matched = [skill for skill in required_skills if _normalise(skill) in candidate_index]
    missing = [skill for skill in required_skills if _normalise(skill) not in candidate_index]
    bonus = [skill for skill in nice_to_have if _normalise(skill) in candidate_index]

    if required_skills:
        base = len(matched) / len(required_skills)
        # Nice-to-haves can lift the skill score, but never beyond 100.
        uplift = (len(bonus) / len(nice_to_have) * 0.10) if nice_to_have else 0.0
        skill_score = min(base + uplift, 1.0) * 100
    else:
        skill_score = 70.0

    experience_score = _score_experience(
        candidate_experience_years, min_experience_years, max_experience_years
    )
    location_score = _score_location(candidate_location, locations)

    total = (
        skill_score * SKILL_WEIGHT
        + experience_score * EXPERIENCE_WEIGHT
        + location_score * LOCATION_WEIGHT
    )

    return MatchBreakdown(
        score=round(total, 1),
        skill_score=round(skill_score, 1),
        experience_score=round(experience_score, 1),
        location_score=round(location_score, 1),
        matched_skills=matched + bonus,
        missing_skills=missing,
        rationale=_rationale(matched, missing, candidate_experience_years, min_experience_years),
    )


def _score_experience(years: float | None, minimum: float | None, maximum: float | None) -> float:
    if years is None:
        return 55.0
    if minimum is None and maximum is None:
        return 75.0
    if minimum is not None and years < minimum:
        # Partial credit rather than a hard zero - a near miss is still a signal.
        shortfall = minimum - years
        return max(30.0, 100.0 - shortfall * 35.0)
    if maximum is not None and years > maximum:
        # Over-qualification is a mild penalty, not a disqualifier.
        return max(60.0, 100.0 - (years - maximum) * 8.0)
    return 100.0


def _score_location(candidate_location: str | None, job_locations: list[str]) -> float:
    if not job_locations:
        return 75.0
    if not candidate_location:
        return 50.0
    haystack = candidate_location.lower()
    if any(item.lower() == "remote" for item in job_locations) or "remote" in haystack:
        return 100.0
    for item in job_locations:
        needle = item.lower()
        if needle in haystack or haystack.split(",")[0].strip() in needle:
            return 100.0
    return 45.0


def _rationale(
    matched: list[str], missing: list[str], years: float | None, minimum: float | None
) -> str:
    parts: list[str] = []
    if matched:
        parts.append(f"Matches {len(matched)} required skills including {', '.join(matched[:3])}.")
    if missing:
        parts.append(f"No evidence of {', '.join(missing[:3])}.")
    if years is not None and minimum is not None:
        if years >= minimum:
            parts.append(f"{years:g} years of experience clears the {minimum:g}-year bar.")
        else:
            parts.append(f"{years:g} years is below the {minimum:g}-year requirement.")
    return " ".join(parts) or "Scored against the parsed job requirements."
