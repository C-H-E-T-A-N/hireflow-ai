"""Start-up diagnostics.

Printed before migrations so that a failed deploy leaves an explanation in the
platform log rather than an unexplained hang. Everything here is safe to log:
the database URL is redacted to driver/host/name, and secrets are reported only
as present or absent.
"""

from __future__ import annotations

import sys
from urllib.parse import urlparse

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


def _redacted_database_url() -> str:
    """driver://user@host:port/name - never the password."""
    try:
        parsed = urlparse(settings.database_url)
    except ValueError:
        return "<unparseable>"

    if parsed.scheme.startswith("sqlite"):
        return f"sqlite -> {parsed.path or settings.database_url}"

    user = f"{parsed.username}@" if parsed.username else ""
    port = f":{parsed.port}" if parsed.port else ""
    return f"{parsed.scheme}://{user}{parsed.hostname or '?'}{port}{parsed.path or ''}"


def main() -> int:
    print("[preflight] --------------------------------------------------")
    print(f"[preflight] environment      : {settings.app_env}")
    print(f"[preflight] database         : {_redacted_database_url()}")
    print(f"[preflight] public url       : {settings.public_url}")
    print(f"[preflight] demo mode        : {settings.demo_mode}")
    print(f"[preflight] hunar key present: {settings.hunar_configured}")
    print(f"[preflight] people search    : {settings.people_search_provider}")
    print(f"[preflight] llm provider     : {settings.llm_provider}")

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("[preflight] database connection: OK")
    except Exception as exc:  # noqa: BLE001 - the message is the whole point
        print("[preflight] database connection: FAILED", file=sys.stderr)
        print(f"[preflight] {type(exc).__name__}: {exc}", file=sys.stderr)
        print(
            "[preflight] Check that DATABASE_URL is set and that the database is "
            "in the SAME REGION as this service - a managed database's internal "
            "connection string does not route across regions.",
            file=sys.stderr,
        )
        return 1

    print("[preflight] --------------------------------------------------")
    return 0


if __name__ == "__main__":
    sys.exit(main())
