"""Aggregations behind the dashboard and analytics screens."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.enums import (
    PIPELINE_ORDER,
    CandidateStage,
    InterestLevel,
    InterviewStatus,
    JobStatus,
    OutreachStatus,
    Recommendation,
)
from app.models.interview import Interview
from app.models.outreach import CandidateResponse, Outreach
from app.models.recruiting import Activity, AIInsight, Candidate, Job, JobMatch

STAGE_LABELS = {
    CandidateStage.SOURCED: "Sourced",
    CandidateStage.CONTACTED: "Contacted",
    CandidateStage.INTERESTED: "Interested",
    CandidateStage.NOT_INTERESTED: "Not interested",
    CandidateStage.INTERVIEW_SCHEDULED: "Interview",
    CandidateStage.INTERVIEW_COMPLETED: "Interviewed",
    CandidateStage.SHORTLISTED: "Shortlisted",
    CandidateStage.REJECTED: "Rejected",
    CandidateStage.HIRED: "Hired",
}


def _count(db: Session, model, *conditions) -> int:
    stmt = select(func.count()).select_from(model)
    for condition in conditions:
        stmt = stmt.where(condition)
    return int(db.execute(stmt).scalar() or 0)


def build_dashboard(db: Session) -> dict[str, Any]:
    week_ago = datetime.now(UTC) - timedelta(days=7)

    active_jobs = _count(db, Job, Job.status == JobStatus.OPEN)
    total_candidates = _count(db, Candidate, Candidate.is_archived.is_(False))
    interviews_total = _count(db, Interview)
    # Count candidates who *said* they were interested on an outreach call rather
    # than those currently sitting in the "interested" stage - otherwise the
    # number drops to zero as soon as they are moved on to an interview.
    interested = int(
        db.execute(
            select(func.count(func.distinct(Outreach.candidate_id)))
            .select_from(CandidateResponse)
            .join(Outreach, Outreach.id == CandidateResponse.outreach_id)
            .where(CandidateResponse.interest_level == InterestLevel.INTERESTED)
        ).scalar()
        or 0
    )

    new_candidates = _count(db, Candidate, Candidate.created_at >= week_ago)
    new_interviews = _count(db, Interview, Interview.created_at >= week_ago)

    stage_counts = dict(
        db.execute(select(Candidate.stage, func.count()).group_by(Candidate.stage)).all()
    )

    pipeline = [
        {
            "stage": stage.value,
            "label": STAGE_LABELS[stage],
            "count": int(stage_counts.get(stage.value, 0)),
        }
        for stage in PIPELINE_ORDER
    ]

    recent_candidates = _recent_candidates(db, limit=6)
    upcoming = _upcoming_interviews(db, limit=4)

    activities = list(
        db.execute(select(Activity).order_by(Activity.created_at.desc()).limit(8)).scalars()
    )

    insights = list(
        db.execute(
            select(AIInsight)
            .where(AIInsight.is_dismissed.is_(False))
            .order_by(AIInsight.created_at.desc())
            .limit(4)
        ).scalars()
    )

    return {
        "metrics": [
            {
                "key": "active_jobs",
                "label": "Active jobs",
                "value": active_jobs,
                "delta": None,
                "hint": f"{_count(db, Job)} total",
            },
            {
                "key": "candidates",
                "label": "Candidates",
                "value": total_candidates,
                "delta": new_candidates,
                "hint": "sourced this week",
            },
            {
                "key": "interviews",
                "label": "AI interviews",
                "value": interviews_total,
                "delta": new_interviews,
                "hint": "created this week",
            },
            {
                "key": "interested",
                "label": "Interested",
                "value": interested,
                "delta": None,
                "hint": "said yes on a call",
            },
        ],
        "pipeline": pipeline,
        "recent_candidates": recent_candidates,
        "upcoming_interviews": upcoming,
        "activities": [
            {
                "id": item.id,
                "type": item.type,
                "message": item.message,
                "actor": item.actor,
                "created_at": item.created_at,
                "candidate_id": item.candidate_id,
                "job_id": item.job_id,
            }
            for item in activities
        ],
        "insights": _insights_payload(db, insights),
    }


def _recent_candidates(db: Session, *, limit: int) -> list[dict[str, Any]]:
    rows = list(
        db.execute(
            select(Candidate)
            .where(Candidate.is_archived.is_(False))
            .order_by(Candidate.last_activity_at.desc().nullslast(), Candidate.created_at.desc())
            .limit(limit)
        ).scalars()
    )

    best_scores = dict(
        db.execute(
            select(JobMatch.candidate_id, func.max(JobMatch.score)).group_by(JobMatch.candidate_id)
        ).all()
    )

    job_titles = dict(db.execute(select(Job.id, Job.title)).all())
    match_jobs = dict(
        db.execute(select(JobMatch.candidate_id, JobMatch.job_id).order_by(JobMatch.score)).all()
    )

    return [
        {
            "id": row.id,
            "full_name": row.full_name,
            "current_title": row.current_title,
            "avatar_url": row.avatar_url,
            "stage": row.stage,
            "match_score": round(best_scores.get(row.id), 1) if best_scores.get(row.id) else None,
            "role": job_titles.get(match_jobs.get(row.id), row.current_title),
            "last_activity_at": row.last_activity_at or row.created_at,
        }
        for row in rows
    ]


def _upcoming_interviews(db: Session, *, limit: int) -> list[dict[str, Any]]:
    rows = list(
        db.execute(
            select(Interview)
            .where(
                Interview.status.in_(
                    [
                        InterviewStatus.SCHEDULED,
                        InterviewStatus.DRAFT,
                        InterviewStatus.DIALING,
                        InterviewStatus.IN_PROGRESS,
                    ]
                )
            )
            .order_by(Interview.scheduled_at.asc().nullslast(), Interview.created_at.desc())
            .limit(limit)
        ).scalars()
    )
    return [
        {
            "id": row.id,
            "title": row.title,
            "status": row.status,
            "scheduled_at": row.scheduled_at,
            "duration_minutes": row.duration_minutes,
            "candidate_name": row.candidate.full_name if row.candidate else None,
            "candidate_id": row.candidate_id,
            "job_title": row.job.title if row.job else None,
        }
        for row in rows
    ]


def _insights_payload(db: Session, stored: list[AIInsight]) -> list[dict[str, Any]]:
    """Stored insights first, topped up with live derived observations."""
    payload = [
        {
            "id": item.id,
            "title": item.title,
            "body": item.body,
            "severity": item.severity,
            "action_label": item.action_label,
            "action_href": item.action_href,
        }
        for item in stored
    ]

    uncontacted = _count(db, Candidate, Candidate.stage == CandidateStage.SOURCED)
    if uncontacted:
        payload.append(
            {
                "id": "derived-uncontacted",
                "title": f"{uncontacted} sourced candidates have not been contacted",
                "body": "Run an AI outreach batch to qualify them in a single pass.",
                "severity": "warning",
                "action_label": "Start outreach",
                "action_href": "/outreach",
            }
        )

    interested_no_interview = db.execute(
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.stage == CandidateStage.INTERESTED,
            ~Candidate.id.in_(select(Interview.candidate_id)),
        )
    ).scalar()
    if interested_no_interview:
        payload.append(
            {
                "id": "derived-interested",
                "title": f"{interested_no_interview} interested candidates have no interview yet",
                "body": "They answered positively on an outreach call. Book the AI interview next.",
                "severity": "info",
                "action_label": "Open candidates",
                "action_href": "/candidates?stage=interested",
            }
        )

    return payload[:5]


def build_analytics(db: Session, *, days: int = 30) -> dict[str, Any]:
    since = datetime.now(UTC) - timedelta(days=days)

    sourced = _count(db, Candidate, Candidate.created_at >= since)
    outreach_total = _count(db, Outreach, Outreach.created_at >= since)
    outreach_completed = _count(
        db,
        Outreach,
        Outreach.created_at >= since,
        Outreach.status == OutreachStatus.COMPLETED,
    )
    interested = _count(
        db, CandidateResponse, CandidateResponse.interest_level == InterestLevel.INTERESTED
    )
    interviews_completed = _count(db, Interview, Interview.status == InterviewStatus.COMPLETED)
    shortlisted = _count(
        db,
        Interview,
        Interview.recommendation.in_([Recommendation.SHORTLIST, Recommendation.STRONG_HIRE]),
    )

    response_rate = round(outreach_completed / outreach_total * 100, 1) if outreach_total else 0.0
    interest_rate = round(interested / outreach_completed * 100, 1) if outreach_completed else 0.0
    shortlist_rate = (
        round(shortlisted / interviews_completed * 100, 1) if interviews_completed else 0.0
    )

    funnel_source = [
        ("Sourced", _count(db, Candidate)),
        ("Contacted", outreach_total),
        ("Connected", outreach_completed),
        ("Interested", interested),
        ("Interviewed", interviews_completed),
        ("Shortlisted", shortlisted),
    ]
    top = funnel_source[0][1] or 1
    funnel = [
        {"stage": label, "count": count, "percent": round(count / top * 100, 1)}
        for label, count in funnel_source
    ]

    scores = [
        row
        for row in db.execute(
            select(Interview.overall_score).where(Interview.overall_score.isnot(None))
        ).scalars()
    ]
    score_buckets = Counter()
    for score in scores:
        bucket = f"{int(score // 10) * 10}-{int(score // 10) * 10 + 9}"
        score_buckets[bucket] += 1

    interest_split = dict(
        db.execute(
            select(CandidateResponse.interest_level, func.count()).group_by(
                CandidateResponse.interest_level
            )
        ).all()
    )

    return {
        "period_days": days,
        "metrics": [
            {"key": "sourced", "label": "Candidates sourced", "value": sourced, "unit": "count"},
            {
                "key": "outreach",
                "label": "Outreach calls",
                "value": outreach_total,
                "unit": "count",
            },
            {
                "key": "response_rate",
                "label": "Connect rate",
                "value": response_rate,
                "unit": "percent",
            },
            {"key": "interested", "label": "Interested", "value": interested, "unit": "count"},
            {
                "key": "interviews",
                "label": "Interviews completed",
                "value": interviews_completed,
                "unit": "count",
            },
            {
                "key": "shortlist_rate",
                "label": "Shortlist rate",
                "value": shortlist_rate,
                "unit": "percent",
            },
        ],
        "funnel": funnel,
        "interest_split": [
            {"label": key.replace("_", " ").title(), "value": int(value)}
            for key, value in interest_split.items()
        ],
        "score_distribution": [
            {"bucket": bucket, "count": count} for bucket, count in sorted(score_buckets.items())
        ],
        "interest_rate": interest_rate,
        "activity_timeline": _activity_timeline(db, days=min(days, 14)),
    }


def _activity_timeline(db: Session, *, days: int) -> list[dict[str, Any]]:
    """Daily counts of sourcing, outreach and interview events."""
    start = (datetime.now(UTC) - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    def bucket(model, column) -> Counter:
        counter: Counter = Counter()
        for value in db.execute(select(column).where(column >= start)).scalars():
            if value is None:
                continue
            counter[value.date().isoformat()] += 1
        return counter

    sourced = bucket(Candidate, Candidate.created_at)
    outreach = bucket(Outreach, Outreach.created_at)
    interviews = bucket(Interview, Interview.created_at)

    series: list[dict[str, Any]] = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date().isoformat()
        series.append(
            {
                "date": day,
                "sourced": sourced.get(day, 0),
                "outreach": outreach.get(day, 0),
                "interviews": interviews.get(day, 0),
            }
        )
    return series


def list_conversations(
    db: Session, *, limit: int = 50, channel: str | None = None
) -> list[Conversation]:
    stmt = select(Conversation).order_by(Conversation.created_at.desc()).limit(limit)
    if channel:
        stmt = stmt.where(Conversation.channel == channel)
    return list(db.execute(stmt).scalars())
