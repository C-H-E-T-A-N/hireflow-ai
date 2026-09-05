"""Health and configuration status.

Reports *whether* each integration is configured and working, never the secret
itself.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.config import settings
from app.integrations.hunar.health import check_hunar
from app.integrations.hunar.service import voice_mode
from app.integrations.llm.factory import active_llm_engine
from app.integrations.people_search.factory import available_providers
from app.schemas.analytics import ProviderStatus, SystemStatus
from app.services.question_bank import AVAILABLE_FOCUS_AREAS

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/system/status", response_model=SystemStatus)
def system_status(
    refresh: bool = Query(default=False, description="Force a fresh Hunar credential check"),
) -> SystemStatus:
    """Configuration and live-integration state.

    The Hunar entry reflects a real credential check, so an expired key shows up
    here as "demo" with the reason - the product keeps working either way.
    """
    hunar = check_hunar(force=refresh)
    mode = voice_mode()
    people_provider = settings.people_search_provider.lower()

    if not settings.hunar_configured:
        hunar_detail = "No API key configured. Conversations are simulated by the demo provider."
    elif settings.demo_mode:
        hunar_detail = (
            "API key is configured and DEMO_MODE is on, so conversations are simulated. "
            "Set DEMO_MODE=false to place real calls."
        )
    else:
        hunar_detail = hunar.reason

    return SystemStatus(
        app_name=settings.app_name,
        environment=settings.app_env,
        demo_mode=settings.demo_mode,
        voice_mode=mode,
        providers=[
            ProviderStatus(
                name="Hunar Voice AI",
                mode=mode,
                configured=hunar.usable,
                detail=hunar_detail,
            ),
            ProviderStatus(
                name="People Search",
                mode="live" if people_provider != "mock" else "mock",
                configured=people_provider == "mock" or bool(settings.pdl_api_key),
                detail=(
                    "Built-in mock dataset. No external people-search API is called."
                    if people_provider == "mock"
                    else f"Live provider: {people_provider}."
                ),
            ),
            ProviderStatus(
                name="Language Model",
                mode=active_llm_engine(),
                configured=True,
                detail=(
                    "Anthropic model in use for parsing, summarising and evaluation."
                    if active_llm_engine() == "anthropic"
                    else "Deterministic rule-based engine. No API key required."
                ),
            ),
        ],
        available_people_search_providers=available_providers(),
        available_focus_areas=AVAILABLE_FOCUS_AREAS,
    )


@router.get("/system/voice-health")
def voice_health(
    refresh: bool = Query(default=True, description="Force a fresh credential check"),
) -> dict:
    """Detailed Hunar connectivity report for the settings screen.

    Useful when the key expires: it shows exactly why live calling is
    unavailable without exposing the credential.
    """
    health = check_hunar(force=refresh)
    return {
        "voice_mode": voice_mode(),
        "demo_mode": settings.demo_mode,
        **health.to_public_dict(),
    }
