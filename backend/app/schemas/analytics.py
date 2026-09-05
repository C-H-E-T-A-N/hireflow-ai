from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class MetricCard(BaseModel):
    key: str
    label: str
    value: float
    delta: float | None = None
    hint: str | None = None
    unit: str | None = None


class PipelineStage(BaseModel):
    stage: str
    label: str
    count: int


class RecentCandidate(BaseModel):
    id: str
    full_name: str
    current_title: str | None
    avatar_url: str | None
    stage: str
    match_score: float | None
    role: str | None
    last_activity_at: datetime | None


class UpcomingInterview(BaseModel):
    id: str
    title: str
    status: str
    scheduled_at: datetime | None
    duration_minutes: int
    candidate_name: str | None
    candidate_id: str | None
    job_title: str | None


class ActivityItem(BaseModel):
    id: str
    type: str
    message: str
    actor: str
    created_at: datetime
    candidate_id: str | None = None
    job_id: str | None = None


class InsightItem(BaseModel):
    id: str
    title: str
    body: str
    severity: str
    action_label: str | None = None
    action_href: str | None = None


class DashboardResponse(BaseModel):
    metrics: list[MetricCard]
    pipeline: list[PipelineStage]
    recent_candidates: list[RecentCandidate]
    upcoming_interviews: list[UpcomingInterview]
    activities: list[ActivityItem]
    insights: list[InsightItem]


class FunnelStage(BaseModel):
    stage: str
    count: int
    percent: float


class LabelledValue(BaseModel):
    label: str
    value: float


class ScoreBucket(BaseModel):
    bucket: str
    count: int


class TimelinePoint(BaseModel):
    date: str
    sourced: int
    outreach: int
    interviews: int


class AnalyticsResponse(BaseModel):
    period_days: int
    metrics: list[MetricCard]
    funnel: list[FunnelStage]
    interest_split: list[LabelledValue]
    score_distribution: list[ScoreBucket]
    interest_rate: float
    activity_timeline: list[TimelinePoint]


# --- System / settings --------------------------------------------------------


class ProviderStatus(BaseModel):
    name: str
    mode: str
    configured: bool
    detail: str


class SystemStatus(BaseModel):
    app_name: str
    environment: str
    demo_mode: bool
    voice_mode: str
    providers: list[ProviderStatus]
    available_people_search_providers: list[str]
    available_focus_areas: list[str]


# --- Attendance (assignment part 3) ------------------------------------------


class LocationRead(ORMModel):
    id: str
    code: str
    name: str
    city: str | None
    region: str | None
    timezone: str
    inbound_number: str | None
    headcount: int
    shift_start: str
    grace_minutes: int


class AttendanceEventRead(BaseModel):
    id: str
    employee_name: str
    employee_code: str
    location_name: str | None
    location_code: str | None
    work_date: date
    check_in_at: datetime | None
    status: str
    verification_method: str
    voice_match_confidence: float | None
    flagged_reason: str | None


class AuditLogRead(ORMModel):
    id: str
    entity_type: str
    entity_id: str | None
    action: str
    actor: str
    detail: str | None
    created_at: datetime


class AttendanceOverview(BaseModel):
    total_employees: int
    total_locations: int
    marked_today: int
    present: int
    late: int
    flagged: int
    verification_split: list[LabelledValue]
    by_location: list[dict[str, Any]]
    recent_events: list[AttendanceEventRead]
    audit_logs: list[AuditLogRead]
