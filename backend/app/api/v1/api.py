from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routers import (
    attendance,
    candidates,
    conversations,
    insights,
    interviews,
    jobs,
    outreach,
    search,
    system,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(insights.router)
api_router.include_router(jobs.router)
api_router.include_router(candidates.router)
api_router.include_router(search.router)
api_router.include_router(interviews.router)
api_router.include_router(outreach.router)
api_router.include_router(conversations.router)
api_router.include_router(attendance.router)
api_router.include_router(webhooks.router)
