"""Read APIs behind the voice-first attendance section (assignment part 3).

The IVR pipeline itself is a system-design deliverable. These endpoints serve the
real schema and seeded operational data that the design page is built on, so the
HR dashboard and audit trail shown there are backed by actual queries.
"""

from __future__ import annotations

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.attendance import AttendanceEvent, AuditLog, Employee, Location
from app.models.enums import AttendanceStatus
from app.schemas.analytics import (
    AttendanceEventRead,
    AttendanceOverview,
    AuditLogRead,
    LabelledValue,
    LocationRead,
)
from app.schemas.common import ListResponse

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/overview", response_model=AttendanceOverview)
def overview(
    work_date: date | None = Query(default=None), db: Session = Depends(get_db)
) -> AttendanceOverview:
    target = work_date or _latest_work_date(db) or date.today()

    total_employees = int(db.execute(select(func.count()).select_from(Employee)).scalar() or 0)
    total_locations = int(db.execute(select(func.count()).select_from(Location)).scalar() or 0)

    events = list(
        db.execute(select(AttendanceEvent).where(AttendanceEvent.work_date == target)).scalars()
    )

    status_counts = Counter(event.status for event in events)
    verification = Counter(event.verification_method for event in events)

    location_names = dict(db.execute(select(Location.id, Location.name)).all())
    location_codes = dict(db.execute(select(Location.id, Location.code)).all())
    headcounts = dict(db.execute(select(Location.id, Location.headcount)).all())

    per_location: Counter = Counter()
    for event in events:
        if event.location_id:
            per_location[event.location_id] += 1

    by_location = [
        {
            "location_id": location_id,
            "name": location_names.get(location_id, "Unknown"),
            "code": location_codes.get(location_id),
            "marked": count,
            "headcount": int(headcounts.get(location_id, 0)),
            "rate": round(count / headcounts[location_id] * 100, 1)
            if headcounts.get(location_id)
            else 0.0,
        }
        for location_id, count in per_location.most_common(12)
    ]

    recent = sorted(events, key=lambda event: event.check_in_at or event.created_at, reverse=True)[
        :12
    ]

    audit = list(
        db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)).scalars()
    )

    return AttendanceOverview(
        total_employees=total_employees,
        total_locations=total_locations,
        marked_today=len(events),
        present=status_counts.get(AttendanceStatus.PRESENT, 0),
        late=status_counts.get(AttendanceStatus.LATE, 0),
        flagged=status_counts.get(AttendanceStatus.PENDING_REVIEW, 0),
        verification_split=[
            LabelledValue(label=key.replace("_", " ").title(), value=value)
            for key, value in verification.items()
        ],
        by_location=by_location,
        recent_events=[_to_event(db, event) for event in recent],
        audit_logs=[AuditLogRead.model_validate(row) for row in audit],
    )


def _latest_work_date(db: Session) -> date | None:
    return db.execute(select(func.max(AttendanceEvent.work_date))).scalar()


def _to_event(db: Session, event: AttendanceEvent) -> AttendanceEventRead:
    employee = event.employee
    location = event.location
    return AttendanceEventRead(
        id=event.id,
        employee_name=employee.full_name if employee else "Unknown",
        employee_code=employee.employee_code if employee else "-",
        location_name=location.name if location else None,
        location_code=location.code if location else None,
        work_date=event.work_date,
        check_in_at=event.check_in_at,
        status=event.status,
        verification_method=event.verification_method,
        voice_match_confidence=event.voice_match_confidence,
        flagged_reason=event.flagged_reason,
    )


@router.get("/locations", response_model=ListResponse[LocationRead])
def list_locations(db: Session = Depends(get_db)) -> ListResponse[LocationRead]:
    rows = list(db.execute(select(Location).order_by(Location.name)).scalars())
    return ListResponse(items=[LocationRead.model_validate(row) for row in rows], total=len(rows))
