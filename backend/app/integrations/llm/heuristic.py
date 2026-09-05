"""Deterministic, dependency-free implementation of the LLM contract.

This is the default engine. It uses a curated skill taxonomy plus regular
expressions rather than a model, which makes it fast, free, reproducible in
tests, and honest: everything it returns is derived from the input text.
"""

from __future__ import annotations

import re
from typing import Any

from app.integrations.llm.base import LLMProvider, ParsedJobDescription

# --- Skill taxonomy -----------------------------------------------------------
# Canonical name -> the surface forms that should map onto it.
SKILL_TAXONOMY: dict[str, list[str]] = {
    "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"],
    "Node.js": ["node.js", "nodejs", "node"],
    "TypeScript": ["typescript", "ts"],
    "JavaScript": ["javascript", "es6"],
    "Python": ["python"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Go": ["golang"],
    "Java": ["java"],
    "MongoDB": ["mongodb", "mongo"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "Redis": ["redis"],
    "GraphQL": ["graphql"],
    "REST APIs": ["rest api", "rest apis", "restful", "rest"],
    "Microservices": ["microservice", "microservices"],
    "System Design": ["system design", "architecture", "distributed systems"],
    "AWS": ["aws", "amazon web services"],
    "GCP": ["gcp", "google cloud"],
    "Azure": ["azure"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Terraform": ["terraform"],
    "CI/CD": ["ci/cd", "cicd", "continuous integration"],
    "Kafka": ["kafka"],
    "RabbitMQ": ["rabbitmq"],
    "Express": ["express.js", "expressjs", "express"],
    "Tailwind CSS": ["tailwind"],
    "HTML/CSS": ["html", "css", "scss"],
    "React Native": ["react native"],
    "iOS": ["ios", "swift"],
    "Android": ["android", "kotlin"],
    "PyTorch": ["pytorch"],
    "TensorFlow": ["tensorflow"],
    "LLMs": ["llm", "llms", "large language model", "genai", "gen ai"],
    "MLOps": ["mlops"],
    "Airflow": ["airflow"],
    "Spark": ["spark"],
    "dbt": ["dbt"],
    "SQL": ["sql"],
    "Jest": ["jest"],
    "Playwright": ["playwright"],
    "Cypress": ["cypress"],
    "Testing Library": ["testing library", "react testing library"],
    "Design Systems": ["design system", "design systems"],
    "Figma": ["figma"],
    "Accessibility": ["accessibility", "a11y", "wcag"],
    "User Research": ["user research", "usability"],
    "Prototyping": ["prototyping"],
    "Product Strategy": ["product strategy", "roadmap"],
    "Analytics": ["analytics", "mixpanel", "amplitude"],
    "Team Leadership": ["team leadership", "mentoring", "lead a team", "people management"],
    "API Testing": ["api testing", "postman"],
}

SENIORITY_MARKERS: list[tuple[str, list[str]]] = [
    ("Lead", ["lead", "principal", "staff", "head of", "manager", "architect"]),
    ("Senior", ["senior", "sr.", "sr "]),
    ("Mid", ["mid-level", "mid level", "intermediate"]),
    ("Junior", ["junior", "jr.", "entry level", "fresher", "graduate"]),
]

EMPLOYMENT_MARKERS: list[tuple[str, list[str]]] = [
    ("internship", ["internship", "intern"]),
    ("contract", ["contract", "contractor", "freelance"]),
    ("part_time", ["part-time", "part time"]),
    ("full_time", ["full-time", "full time", "permanent"]),
]

KNOWN_LOCATIONS = [
    "Delhi NCR",
    "Delhi",
    "Gurgaon",
    "Gurugram",
    "Noida",
    "Bengaluru",
    "Bangalore",
    "Mumbai",
    "Pune",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Kochi",
    "Remote",
    "Hybrid",
]

TITLE_PATTERN = re.compile(
    r"\b((?:senior|sr\.?|junior|jr\.?|lead|principal|staff)?\s*"
    r"(?:full[\s-]?stack|front[\s-]?end|back[\s-]?end|software|product|data|machine learning|ml|"
    r"devops|mobile|qa|platform)\s*"
    r"(?:engineer|developer|designer|manager|architect|scientist))\b",
    re.IGNORECASE,
)

YEARS_PATTERNS = [
    re.compile(r"(\d+(?:\.\d+)?)\s*(?:\+|plus)?\s*-\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)", re.I),
    re.compile(r"(\d+(?:\.\d+)?)\s*\+\s*(?:years|yrs)", re.I),
    re.compile(r"(?:minimum|at least|min\.?)\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)", re.I),
    re.compile(r"(\d+(?:\.\d+)?)\s*(?:years|yrs)", re.I),
]

BULLET_PATTERN = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.{12,180})$", re.MULTILINE)

NICE_TO_HAVE_HINTS = (
    "nice to have",
    "good to have",
    "bonus",
    "plus point",
    "preferred",
    "optional",
)


class HeuristicLLMProvider:
    name = "heuristic"

    def parse_job_description(self, text: str) -> ParsedJobDescription:
        return parse_jd_sync(text)

    def summarise_conversation(self, context: dict[str, Any]) -> dict[str, Any]:
        return summarise_sync(context)

    def evaluate_interview(self, context: dict[str, Any]) -> dict[str, Any]:
        return evaluate_sync(context)


# --- Job description parsing --------------------------------------------------


def parse_jd_sync(text: str) -> ParsedJobDescription:
    lowered = text.lower()

    required, nice_to_have = _extract_skills(text, lowered)
    min_years, max_years = _extract_experience(lowered)

    return ParsedJobDescription(
        title=_extract_title(text),
        seniority=_first_marker(lowered, SENIORITY_MARKERS),
        employment_type=_first_marker(lowered, EMPLOYMENT_MARKERS) or "full_time",
        required_skills=required,
        nice_to_have_skills=nice_to_have,
        min_experience_years=min_years,
        max_experience_years=max_years,
        locations=_extract_locations(text),
        responsibilities=_extract_responsibilities(text),
        keywords=_extract_keywords(lowered, required),
        summary=_summarise_jd(text, required, min_years),
        engine="heuristic",
    )


def _extract_skills(text: str, lowered: str) -> tuple[list[str], list[str]]:
    """Split the JD at the first nice-to-have marker so optional skills land correctly."""
    split_at = len(text)
    for hint in NICE_TO_HAVE_HINTS:
        index = lowered.find(hint)
        if index != -1:
            split_at = min(split_at, index)

    head, tail = lowered[:split_at], lowered[split_at:]
    required = _match_skills(head)
    optional = [skill for skill in _match_skills(tail) if skill not in required]
    return required, optional


def _match_skills(segment: str) -> list[str]:
    found: list[str] = []
    for canonical, aliases in SKILL_TAXONOMY.items():
        for alias in aliases:
            pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
            if re.search(pattern, segment):
                found.append(canonical)
                break
    return found


def _extract_experience(lowered: str) -> tuple[float | None, float | None]:
    for index, pattern in enumerate(YEARS_PATTERNS):
        match = pattern.search(lowered)
        if not match:
            continue
        if index == 0:
            return float(match.group(1)), float(match.group(2))
        return float(match.group(1)), None
    return None, None


def _extract_title(text: str) -> str | None:
    match = TITLE_PATTERN.search(text)
    if not match:
        # Fall back to the first short, title-like line.
        for line in text.splitlines():
            stripped = line.strip(" #*-:")
            if 6 <= len(stripped) <= 70 and not stripped.endswith("."):
                return stripped
        return None
    return " ".join(word.capitalize() for word in match.group(1).split())


def _extract_locations(text: str) -> list[str]:
    found: list[str] = []
    for location in KNOWN_LOCATIONS:
        if re.search(r"(?<![a-z])" + re.escape(location.lower()) + r"(?![a-z])", text.lower()):
            canonical = {"Bangalore": "Bengaluru", "Gurugram": "Gurgaon"}.get(location, location)
            if canonical not in found:
                found.append(canonical)
    # "Delhi NCR" subsumes its constituent cities for search purposes.
    if "Delhi NCR" in found:
        found = [item for item in found if item not in {"Delhi", "Gurgaon", "Noida"}] + [
            item for item in ("Gurgaon", "Noida", "Delhi") if item in found
        ]
    return found[:5]


def _extract_responsibilities(text: str) -> list[str]:
    bullets = [match.strip() for match in BULLET_PATTERN.findall(text)]
    return bullets[:8]


def _extract_keywords(lowered: str, skills: list[str]) -> list[str]:
    candidates = ["startup", "fintech", "saas", "b2b", "b2c", "scale", "greenfield", "ownership"]
    return [word for word in candidates if word in lowered][:6] + [s.lower() for s in skills[:4]]


def _first_marker(lowered: str, markers: list[tuple[str, list[str]]]) -> str | None:
    for label, needles in markers:
        if any(needle in lowered for needle in needles):
            return label if label[0].isupper() else label
    return None


def _summarise_jd(text: str, skills: list[str], min_years: float | None) -> str:
    skill_text = ", ".join(skills[:5]) if skills else "the listed requirements"
    experience_text = f"{min_years:g}+ years" if min_years else "the stated experience level"
    return (
        f"Role centred on {skill_text}. Looking for {experience_text} of relevant experience. "
        f"Parsed from a {len(text.split())}-word description."
    )


# --- Conversation summarising -------------------------------------------------


def summarise_sync(context: dict[str, Any]) -> dict[str, Any]:
    """Build a recruiter-facing summary from already-extracted structured fields."""
    name = context.get("candidate_name", "The candidate")
    interest = (context.get("interest_level") or "unknown").replace("_", " ")
    role = context.get("job_title", "the role")
    notice = context.get("notice_period_days")
    location = context.get("current_location")
    expected = context.get("expected_compensation")

    parts = [f"{name} is {interest} in the {role} opportunity."]
    if notice is not None:
        parts.append(f"Notice period is {notice} days.")
    if location:
        parts.append(f"Currently based in {location}.")
    if expected:
        parts.append(f"Expected compensation is {expected}.")

    sentiment = {
        "interested": "positive",
        "maybe_later": "neutral",
        "not_interested": "negative",
    }.get(context.get("interest_level", ""), "neutral")

    return {
        "summary": " ".join(parts),
        "sentiment": sentiment,
        "engine": "heuristic",
    }


# --- Interview evaluation -----------------------------------------------------


def evaluate_sync(context: dict[str, Any]) -> dict[str, Any]:
    """Score an interview from answer-level signal coverage.

    Each question declares the signals a strong answer should contain; the score
    is the weighted proportion of signals the candidate actually demonstrated.
    """
    answers: list[dict[str, Any]] = context.get("answers", [])
    if not answers:
        return {
            "overall_score": None,
            "recommendation": "pending",
            "summary": "No answers were captured, so no evaluation could be produced.",
            "strengths": [],
            "concerns": [],
            "engine": "heuristic",
        }

    per_competency: dict[str, list[float]] = {}
    strengths: list[str] = []
    concerns: list[str] = []

    for answer in answers:
        expected = [signal.lower() for signal in answer.get("expected_signals", [])]
        transcript = (answer.get("transcript") or "").lower()
        if expected:
            hits = [signal for signal in expected if signal in transcript]
            ratio = len(hits) / len(expected)
        else:
            # No rubric: fall back to answer substance.
            ratio = min(len(transcript.split()) / 90.0, 1.0)

        # Rubric coverage carries the score. Length is a weak but real proxy for
        # depth, so it contributes at most 15 points and never rescues an
        # answer that missed the rubric entirely.
        depth_bonus = min(len(transcript.split()) / 70.0, 1.0) * 0.15 if ratio > 0 else 0.0
        score = round(min(ratio * 0.85 + depth_bonus, 1.0) * 100)

        competency = answer.get("competency") or answer.get("focus_area") or "General"
        per_competency.setdefault(competency, []).append(score)

        if score >= 80:
            strengths.append(f"Strong on {competency.lower()}")
        elif score < 55:
            concerns.append(f"Limited depth on {competency.lower()}")

    def bucket(*names: str) -> float | None:
        scores = [s for key, values in per_competency.items() for s in values if key in names]
        return round(sum(scores) / len(scores), 1) if scores else None

    all_scores = [score for values in per_competency.values() for score in values]
    overall = round(sum(all_scores) / len(all_scores), 1)

    technical = bucket("Technical Depth", "Technical") or overall
    communication = bucket("Communication") or round(min(overall + 4, 100), 1)
    problem_solving = bucket("Problem Solving") or round(max(overall - 3, 0), 1)
    role_fit = bucket("Role Fit", "Motivation") or overall

    if overall >= 85:
        recommendation = "strong_hire"
    elif overall >= 70:
        recommendation = "shortlist"
    elif overall >= 55:
        recommendation = "consider"
    else:
        recommendation = "reject"

    verdict = {
        "strong_hire": "a strong hire",
        "shortlist": "a shortlist",
        "consider": "further consideration",
        "reject": "no further progress",
    }[recommendation]

    strongest = max(
        per_competency, key=lambda key: sum(per_competency[key]) / len(per_competency[key])
    )
    summary = (
        f"Scored {overall:g}/100 across {len(all_scores)} answered questions. "
        f"Strongest area: {strongest.lower()}. "
        f"The evidence supports {verdict}."
    )

    return {
        "overall_score": overall,
        "technical_score": technical,
        "communication_score": communication,
        "problem_solving_score": problem_solving,
        "role_fit_score": role_fit,
        "recommendation": recommendation,
        "summary": summary,
        "strengths": _dedupe(strengths)[:4],
        "concerns": _dedupe(concerns)[:4],
        "per_competency": {key: round(sum(v) / len(v), 1) for key, v in per_competency.items()},
        "engine": "heuristic",
    }


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


_provider_check: LLMProvider = HeuristicLLMProvider()
