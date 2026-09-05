from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    logger.info(
        "%s starting | env=%s | voice=%s | people_search=%s | llm=%s",
        settings.app_name,
        settings.app_env,
        "live" if settings.live_voice_enabled else "demo",
        settings.people_search_provider,
        settings.llm_provider,
    )
    if settings.demo_mode:
        logger.info("DEMO_MODE is on: voice conversations are simulated, no calls are placed.")
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    description=(
        "Backend for HireFlow AI - AI voice interviewing, candidate sourcing and "
        "automated outreach."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }
