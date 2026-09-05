"""Voice-first attendance domain (assignment part 3).

The telephony/IVR pipeline itself is a system design deliverable rather than a
built product, but the data model and read APIs are real: the attendance page is
backed by these tables so the design is grounded in a concrete schema.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AttendanceStatus, AttendanceVerification


class Location(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "locations"

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(60), default="Asia/Kolkata", nullable=False)
    # DID assigned to this site. Calling it is itself a location assertion.
    inbound_number: Mapped[str | None] = mapped_column(String(32))
    headcount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shift_start: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    grace_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    employees: Mapped[list[Employee]] = relationship(back_populates="location")


class Employee(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "employees"

    employee_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), index=True)
    designation: Mapped[str | None] = mapped_column(String(120))
    location_id: Mapped[str | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    # We never store audio: only a non-reversible embedding reference.
    voiceprint_enrolled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    voiceprint_ref: Mapped[str | None] = mapped_column(String(120))

    location: Mapped[Location | None] = relationship(back_populates="employees")


class AttendanceEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attendance_events"

    employee_id: Mapped[str] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[str | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(30), default=AttendanceStatus.PRESENT, nullable=False, index=True
    )
    verification_method: Mapped[str] = mapped_column(
        String(30), default=AttendanceVerification.VOICEPRINT, nullable=False
    )
    voice_match_confidence: Mapped[float | None] = mapped_column(Float)
    caller_number: Mapped[str | None] = mapped_column(String(32))
    dialled_number: Mapped[str | None] = mapped_column(String(32))
    flagged_reason: Mapped[str | None] = mapped_column(String(200))

    employee: Mapped[Employee] = relationship()
    location: Mapped[Location | None] = relationship()


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only trail. Attendance is payroll data, so every decision is kept."""

    __tablename__ = "audit_logs"

    entity_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(60), index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), default="system", nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
