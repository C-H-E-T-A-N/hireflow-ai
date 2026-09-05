"""Rules that decide whether a given call may be placed for real.

Live calling is not simply "is a key configured". A phone number that came from
the mock people-search dataset belongs to nobody, and dialling it would at best
waste calling minutes and at worst ring a stranger. This module is the single
place that decision is made, so no caller can forget to make it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.logging import get_logger
from app.models.recruiting import Candidate

logger = get_logger(__name__)

# Providers whose contact details are fabricated for demonstration.
SIMULATED_SOURCE_PROVIDERS = {"mock", "mock_dataset", "demo"}

# The reserved range used by the built-in mock dataset.
FABRICATED_NUMBER_PATTERN = re.compile(r"^\+?9199999")

E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


@dataclass(slots=True)
class CallDecision:
    """Whether this specific call may go out over real telephony."""

    allow_live: bool
    reason: str

    @property
    def simulated(self) -> bool:
        return not self.allow_live


def decide_for_candidate(candidate: Candidate) -> CallDecision:
    """Decide whether a real call to this candidate is permitted."""
    source = (candidate.source_provider or "").lower()
    if source in SIMULATED_SOURCE_PROVIDERS:
        return CallDecision(
            allow_live=False,
            reason=(
                "This candidate came from the built-in mock dataset, so the phone number is "
                "fabricated. The conversation is simulated instead of dialled."
            ),
        )

    number = (candidate.phone or "").strip()

    if not number:
        return CallDecision(
            allow_live=False,
            reason="No phone number on file, so the conversation is simulated.",
        )

    if FABRICATED_NUMBER_PATTERN.match(number):
        return CallDecision(
            allow_live=False,
            reason=(
                "The number is in the reserved demonstration range and is not dialable. "
                "The conversation is simulated instead."
            ),
        )

    if not E164_PATTERN.match(number):
        return CallDecision(
            allow_live=False,
            reason=(
                f"'{number}' is not a valid E.164 number, so the call cannot be placed. "
                "The conversation is simulated instead."
            ),
        )

    return CallDecision(allow_live=True, reason="Real contact details: the call will be placed.")
