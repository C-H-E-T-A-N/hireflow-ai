"""Liveness and credential checks for the Hunar voice platform.

The whole point of this module is that an absent, invalid or expired API key is
a *normal* condition, not an error. The result is cached so a dead credential
does not cost a network round trip on every request, and the rest of the
application uses it to decide whether live calling is genuinely available.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.hunar.client import HunarClient

logger = get_logger(__name__)

# How long a health result is trusted before we re-check.
HEALTHY_TTL = timedelta(minutes=10)
UNHEALTHY_TTL = timedelta(minutes=2)


@dataclass(slots=True)
class HunarHealth:
    """Snapshot of whether live calling is actually possible right now."""

    configured: bool = False
    reachable: bool = False
    authenticated: bool = False
    agent_count: int = 0
    caller_ids: list[str] = field(default_factory=list)
    reason: str = "No Hunar API key is configured."
    checked_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def usable(self) -> bool:
        """True when we can place a call through Hunar right now."""
        return self.configured and self.reachable and self.authenticated

    @property
    def has_caller_id(self) -> bool:
        """Hunar can auto-select a number, but no numbers at all is a red flag."""
        return bool(self.caller_ids)

    def to_public_dict(self) -> dict:
        """Client-safe summary. Never includes the key itself."""
        return {
            "configured": self.configured,
            "reachable": self.reachable,
            "authenticated": self.authenticated,
            "usable": self.usable,
            "agent_count": self.agent_count,
            "caller_id_count": len(self.caller_ids),
            "reason": self.reason,
            "checked_at": self.checked_at.isoformat(),
        }


_cache: HunarHealth | None = None
_lock = threading.Lock()


def check_hunar(*, force: bool = False) -> HunarHealth:
    """Return the cached health, re-checking when the cache has expired.

    Read-only: it lists agents and phone numbers. It never creates anything and
    never places a call.
    """
    global _cache

    with _lock:
        if _cache is not None and not force:
            age = datetime.now(UTC) - _cache.checked_at
            ttl = HEALTHY_TTL if _cache.usable else UNHEALTHY_TTL
            if age < ttl:
                return _cache

        _cache = _probe()
        return _cache


def _probe() -> HunarHealth:
    if not settings.hunar_configured:
        return HunarHealth(
            configured=False,
            reason="No Hunar API key is configured. Using the demo voice provider.",
        )

    client = HunarClient()

    try:
        agents = client.list_agents(page_size=1)
    except Exception as exc:  # noqa: BLE001 - any failure means "not usable"
        status = getattr(exc, "status_code", None)
        if status in (401, 403):
            reason = (
                "The Hunar API key was rejected (it may have expired). "
                "Falling back to the demo voice provider."
            )
            authenticated = False
            reachable = True
        elif status == 402:
            reason = (
                "The Hunar subscription is expired or out of calling minutes. "
                "Falling back to the demo voice provider."
            )
            authenticated = True
            reachable = True
        else:
            reason = (
                "The Hunar voice platform could not be reached. "
                "Falling back to the demo voice provider."
            )
            authenticated = False
            reachable = False

        logger.warning("Hunar health check failed: %s", reason)
        return HunarHealth(
            configured=True,
            reachable=reachable,
            authenticated=authenticated,
            reason=reason,
        )

    # Caller IDs are informational: Hunar picks one automatically when we omit
    # `from_phone_number`, but an org with none at all usually cannot dial out.
    caller_ids: list[str] = []
    try:
        caller_ids = [number.phone_number for number in client.list_numbers(page_size=50)]
    except Exception:  # noqa: BLE001 - optional signal, never fatal
        logger.debug("Could not list Hunar phone numbers", exc_info=True)

    reason = "Connected to Hunar. Live calling is available."
    if not caller_ids:
        reason = (
            "Connected to Hunar, but the organisation has no validated caller ID. "
            "Outbound calls may be rejected by the telephony provider."
        )

    logger.info(
        "Hunar health check passed: %s agents, %s caller ids", agents.count, len(caller_ids)
    )
    return HunarHealth(
        configured=True,
        reachable=True,
        authenticated=True,
        agent_count=int(agents.count or 0),
        caller_ids=caller_ids,
        reason=reason,
    )


def reset_cache() -> None:
    """Drop the cached result. Used by tests and by the manual re-check endpoint."""
    global _cache
    with _lock:
        _cache = None
