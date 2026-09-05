"""Anthropic-backed implementation of the LLM contract.

Enabled with LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY. Calls the Messages
API over httpx (no extra SDK dependency) and asks for strict JSON. If the model
is unreachable or returns something unparseable, the deterministic heuristic
engine answers instead so a network hiccup can never break a demo.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.llm.base import ParsedJobDescription
from app.integrations.llm.heuristic import evaluate_sync, parse_jd_sync, summarise_sync

logger = get_logger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class AnthropicLLMProvider:
    name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or settings.anthropic_api_key
        self._model = model or settings.anthropic_model

    def _complete_json(
        self, system: str, user: str, *, max_tokens: int = 1500
    ) -> dict[str, Any] | None:
        if not self._api_key:
            return None
        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.post(
                    ANTHROPIC_URL,
                    headers={
                        "x-api-key": self._api_key,
                        "anthropic-version": ANTHROPIC_VERSION,
                        "content-type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "max_tokens": max_tokens,
                        "system": system,
                        "messages": [
                            {"role": "user", "content": user},
                            # Prefill forces the reply to start as raw JSON.
                            {"role": "assistant", "content": "{"},
                        ],
                    },
                )
            if response.status_code >= 400:
                logger.warning("Anthropic call failed with %s", response.status_code)
                return None
            blocks = response.json().get("content", [])
            text = "".join(block.get("text", "") for block in blocks if block.get("type") == "text")
            return json.loads("{" + text[: text.rfind("}") + 1] if "}" in text else "{}")
        except (httpx.HTTPError, ValueError, KeyError):
            logger.warning("Anthropic response could not be used; using heuristic engine.")
            return None

    def parse_job_description(self, text: str) -> ParsedJobDescription:
        data = self._complete_json(
            system=(
                "You extract structured hiring requirements from job descriptions. "
                "Reply with JSON only, no prose."
            ),
            user=(
                "Extract these keys from the job description below: title, seniority, "
                "employment_type (full_time|part_time|contract|internship), required_skills "
                "(array), nice_to_have_skills (array), min_experience_years (number or null), "
                "max_experience_years (number or null), locations (array), responsibilities "
                "(array of short strings), keywords (array), summary (two sentences). "
                "Only include skills that actually appear in the text.\n\n"
                f"JOB DESCRIPTION:\n{text}"
            ),
        )
        if not data:
            return parse_jd_sync(text)

        fallback = parse_jd_sync(text)
        return ParsedJobDescription(
            title=data.get("title") or fallback.title,
            seniority=data.get("seniority") or fallback.seniority,
            employment_type=data.get("employment_type") or fallback.employment_type,
            required_skills=_as_list(data.get("required_skills")) or fallback.required_skills,
            nice_to_have_skills=_as_list(data.get("nice_to_have_skills")),
            min_experience_years=_as_float(data.get("min_experience_years")),
            max_experience_years=_as_float(data.get("max_experience_years")),
            locations=_as_list(data.get("locations")) or fallback.locations,
            responsibilities=_as_list(data.get("responsibilities")) or fallback.responsibilities,
            keywords=_as_list(data.get("keywords")),
            summary=data.get("summary") or fallback.summary,
            engine="anthropic",
        )

    def summarise_conversation(self, context: dict[str, Any]) -> dict[str, Any]:
        data = self._complete_json(
            system=(
                "You summarise recruiting phone calls for a hiring manager. "
                "Reply with JSON only. Never invent facts that are not in the transcript."
            ),
            user=(
                "Return keys: summary (two sentences), sentiment "
                "(positive|neutral|negative), recommendation "
                "(high_potential|worth_pursuing|nurture|disqualify).\n\n"
                f"CALL CONTEXT:\n{json.dumps(context, default=str)[:8000]}"
            ),
            max_tokens=600,
        )
        if not data or not data.get("summary"):
            return summarise_sync(context)
        return {**data, "engine": "anthropic"}

    def evaluate_interview(self, context: dict[str, Any]) -> dict[str, Any]:
        data = self._complete_json(
            system=(
                "You are a rigorous technical interviewer producing a fair, evidence-based "
                "scorecard. Reply with JSON only. Cite only what the candidate actually said."
            ),
            user=(
                "Return keys: overall_score, technical_score, communication_score, "
                "problem_solving_score, role_fit_score (all integers 0-100), recommendation "
                "(strong_hire|shortlist|consider|reject), strengths (array), concerns (array), "
                "summary (three sentences).\n\n"
                f"INTERVIEW:\n{json.dumps(context, default=str)[:12000]}"
            ),
            max_tokens=1200,
        )
        if not data or data.get("overall_score") is None:
            return evaluate_sync(context)
        return {**data, "engine": "anthropic"}


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [part.strip() for part in value.split(",") if part.strip()]
    return []


def _as_float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
