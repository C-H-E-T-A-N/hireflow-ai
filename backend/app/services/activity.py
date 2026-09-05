from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.enums import ActivityType, InsightSeverity
from app.models.recruiting import Activity, AIInsight


def log_activity(
    db: Session,
    *,
    type: ActivityType | str,
    message: str,
    actor: str = "HireFlow AI",
    candidate_id: str | None = None,
    job_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> Activity:
    activity = Activity(
        type=str(type),
        message=message,
        actor=actor,
        candidate_id=candidate_id,
        job_id=job_id,
        meta=meta or {},
    )
    db.add(activity)
    return activity


def add_insight(
    db: Session,
    *,
    title: str,
    body: str,
    severity: InsightSeverity | str = InsightSeverity.INFO,
    action_label: str | None = None,
    action_href: str | None = None,
    candidate_id: str | None = None,
    job_id: str | None = None,
) -> AIInsight:
    insight = AIInsight(
        title=title,
        body=body,
        severity=str(severity),
        action_label=action_label,
        action_href=action_href,
        candidate_id=candidate_id,
        job_id=job_id,
    )
    db.add(insight)
    return insight
