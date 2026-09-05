from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """String UUID primary key.

    Stored as a 36-character string so the same migration set runs unchanged on
    PostgreSQL and on the local SQLite fallback.
    """

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


def ensure_utc(value: datetime | None) -> datetime | None:
    """Attach UTC to a naive datetime.

    SQLite has no native timezone type and hands back naive values, so every
    datetime read out of the database is normalised here before arithmetic.
    """
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value
