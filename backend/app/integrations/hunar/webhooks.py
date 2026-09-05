"""Verification for Hunar webhook deliveries.

Hunar signs each delivery with a base64 HMAC-SHA256 in `X-Hunar-Signature` and a
unix timestamp in `X-Hunar-Timestamp`. Multiple signatures may be comma
separated while a key is being rotated.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

SIGNATURE_HEADER = "X-Hunar-Signature"
TIMESTAMP_HEADER = "X-Hunar-Timestamp"
MAX_SKEW_SECONDS = 300


def verify_signature(body: bytes, signature_header: str | None, timestamp: str | None) -> bool:
    """Return True when the delivery is authentic.

    If no webhook secret is configured the payload cannot be verified; we log
    loudly and reject in production while allowing local development through.
    """
    secret = settings.hunar_webhook_secret
    if not secret:
        if settings.app_env == "production":
            logger.error("Rejecting Hunar webhook: HUNAR_WEBHOOK_SECRET is not configured.")
            return False
        logger.warning("HUNAR_WEBHOOK_SECRET is unset - accepting webhook unverified (dev only).")
        return True

    if not signature_header:
        return False

    if timestamp:
        try:
            if abs(time.time() - float(timestamp)) > MAX_SKEW_SECONDS:
                logger.warning("Rejecting Hunar webhook: timestamp outside the allowed window.")
                return False
        except ValueError:
            return False

    signed_payload = f"{timestamp}.".encode() + body if timestamp else body
    expected = base64.b64encode(
        hmac.new(secret.encode(), signed_payload, hashlib.sha256).digest()
    ).decode()

    candidates = [part.strip() for part in signature_header.split(",") if part.strip()]
    return any(hmac.compare_digest(expected, candidate) for candidate in candidates)
