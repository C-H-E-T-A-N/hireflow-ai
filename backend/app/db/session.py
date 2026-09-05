from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

_connect_args: dict = {}
_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}

if settings.is_sqlite:
    # SQLite is the zero-config local fallback; FastAPI serves sync endpoints
    # from a threadpool so connections must be shareable across threads.
    _connect_args["check_same_thread"] = False
    _engine_kwargs.pop("pool_pre_ping")
else:
    # Fail fast when the database is unreachable. Without this, a misrouted
    # connection string (for example a managed database in a different region
    # from the service) makes start-up hang indefinitely instead of logging a
    # clear error, which is very hard to diagnose from outside the platform.
    _connect_args["connect_timeout"] = 10

engine = create_engine(settings.database_url, connect_args=_connect_args, **_engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
