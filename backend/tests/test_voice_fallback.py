"""The product must keep working when Hunar is unavailable.

The API key is short-lived, so these tests pin the behaviour that matters: an
expired, rejected or unreachable Hunar never breaks a workflow - it degrades to
the demo provider and the recruiter still gets a result.
"""

from __future__ import annotations

import pytest

from app.core.errors import IntegrationError
from app.integrations.hunar import health as health_module
from app.integrations.hunar.agents import build_outreach_blueprint
from app.integrations.hunar.base import ScriptedTurn, VoiceCallSpec
from app.integrations.hunar.health import HunarHealth, check_hunar
from app.integrations.hunar.service import ResilientVoiceProvider
from app.models.recruiting import Candidate
from app.services.voice_policy import decide_for_candidate


@pytest.fixture(autouse=True)
def _clear_health_cache():
    health_module.reset_cache()
    yield
    health_module.reset_cache()


def _spec(**overrides) -> VoiceCallSpec:
    defaults = dict(
        purpose="outreach",
        blueprint=build_outreach_blueprint(job_title="Backend Engineer", company="HireFlow"),
        callee_name="Test Candidate",
        mobile_number="+919812345678",
        demo_script=[ScriptedTurn("agent", "Hello?", 0.0)],
        demo_result={"interest_level": "interested"},
    )
    defaults.update(overrides)
    return VoiceCallSpec(**defaults)


# --- Health checks -----------------------------------------------------------


def test_missing_key_reports_unusable(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", None)
    health = check_hunar(force=True)
    assert health.usable is False
    assert health.configured is False


def test_expired_key_is_reported_not_raised(monkeypatch):
    """A 401 must produce an explanatory health result, never an exception."""
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "expired-key")

    def _reject(*_args, **_kwargs):
        error = IntegrationError("Hunar rejected the API key.")
        error.status_code = 401
        raise error

    monkeypatch.setattr("app.integrations.hunar.client.HunarClient.list_agents", _reject)

    health = check_hunar(force=True)
    assert health.usable is False
    assert health.authenticated is False
    assert "expired" in health.reason.lower()


def test_health_result_never_leaks_the_key(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "super-secret-value")
    payload = str(check_hunar(force=True).to_public_dict())
    assert "super-secret-value" not in payload


# --- Provider fallback -------------------------------------------------------


def test_falls_back_to_demo_when_key_is_unusable(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.demo_mode", False)
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "expired-key")
    monkeypatch.setattr(
        "app.integrations.hunar.service.check_hunar",
        lambda **_: HunarHealth(
            configured=True, reachable=True, authenticated=False, reason="expired"
        ),
    )

    state = ResilientVoiceProvider().place_call(_spec())

    assert state.provider == "demo"
    assert state.raw_payload["fallback_reason"] == "expired"


def test_falls_back_when_the_live_call_raises(monkeypatch):
    """Even a healthy key can fail mid-call; the workflow must still complete."""
    monkeypatch.setattr("app.core.config.settings.demo_mode", False)
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "valid-key")
    monkeypatch.setattr(
        "app.integrations.hunar.service.check_hunar",
        lambda **_: HunarHealth(configured=True, reachable=True, authenticated=True, reason="ok"),
    )

    def _explode(*_args, **_kwargs):
        raise IntegrationError("Telephony rejected the destination number.")

    monkeypatch.setattr("app.integrations.hunar.service.HunarVoiceProvider.place_call", _explode)

    state = ResilientVoiceProvider().place_call(_spec())

    assert state.provider == "demo"
    assert "Telephony rejected" in state.raw_payload["fallback_reason"]


def test_demo_mode_never_dials(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.demo_mode", True)
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "valid-key")

    def _fail(*_args, **_kwargs):
        raise AssertionError("A live call must not be attempted while DEMO_MODE is on.")

    monkeypatch.setattr("app.integrations.hunar.service.HunarVoiceProvider.place_call", _fail)

    state = ResilientVoiceProvider().place_call(_spec())
    assert state.provider == "demo"


def test_refresh_routes_by_the_provider_that_placed_the_call(monkeypatch):
    """A simulated call must never be polled against the live API."""
    monkeypatch.setattr("app.core.config.settings.demo_mode", False)
    monkeypatch.setattr("app.core.config.settings.hunar_api_key", "valid-key")

    def _fail(*_args, **_kwargs):
        raise AssertionError("Demo calls must not hit the live API.")

    monkeypatch.setattr("app.integrations.hunar.service.HunarVoiceProvider.refresh_call", _fail)

    provider = ResilientVoiceProvider()
    state = provider.place_call(_spec(allow_live=False, simulation_reason="policy"))
    refreshed = provider.refresh_call(state)

    assert refreshed.provider == "demo"


# --- Call policy -------------------------------------------------------------


def test_mock_sourced_candidates_are_never_dialled():
    candidate = Candidate(
        full_name="Aarav Mehta",
        phone="+919999912345",
        source_provider="mock",
    )
    decision = decide_for_candidate(candidate)
    assert decision.allow_live is False
    assert "mock dataset" in decision.reason


def test_reserved_demo_number_range_is_never_dialled():
    candidate = Candidate(full_name="Test", phone="+919999900001", source_provider="manual")
    assert decide_for_candidate(candidate).allow_live is False


def test_malformed_number_is_never_dialled():
    candidate = Candidate(full_name="Test", phone="not-a-number", source_provider="manual")
    assert decide_for_candidate(candidate).allow_live is False


def test_missing_number_simulates_instead_of_failing():
    candidate = Candidate(full_name="Test", phone=None, source_provider="manual")
    decision = decide_for_candidate(candidate)
    assert decision.allow_live is False
    assert "No phone number" in decision.reason


def test_real_looking_number_is_allowed():
    candidate = Candidate(full_name="Real Person", phone="+919812345678", source_provider="pdl")
    assert decide_for_candidate(candidate).allow_live is True
