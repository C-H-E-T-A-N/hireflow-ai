"""Application configuration.

Every secret is read from the environment. Nothing here is ever serialised to a
client-facing response - see app/api/v1/routers/system.py for the redacted,
browser-safe view of this configuration.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application ---------------------------------------------------------
    app_name: str = "HireFlow AI"
    app_env: str = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "dev-only-secret-change-me"

    # --- Database ------------------------------------------------------------
    # Defaults to a local SQLite file so the project boots with zero infra.
    # Production and staging should always point this at PostgreSQL.
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'hireflow.db').as_posix()}"

    # --- CORS ----------------------------------------------------------------
    cors_origins: str = "http://localhost:3000"

    # --- Hunar.ai voice platform ---------------------------------------------
    hunar_api_key: str | None = None
    hunar_base_url: str = "https://api.voice.hunar.ai/external/v1"
    hunar_default_language: str = "ENGLISH"
    hunar_default_voice_persona: str = "NEHA"
    hunar_from_phone_number: str | None = None
    hunar_webhook_secret: str | None = None
    hunar_timeout_seconds: float = 30.0
    public_backend_url: str = "http://localhost:8000"

    # --- People search -------------------------------------------------------
    people_search_provider: str = "mock"
    pdl_api_key: str | None = None

    # --- LLM -----------------------------------------------------------------
    llm_provider: str = "heuristic"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"

    # --- Demo mode -----------------------------------------------------------
    demo_mode: bool = Field(
        default=True,
        description=(
            "When true, voice calls are handled by the clearly labelled demo "
            "provider instead of dialling real phone numbers through Hunar."
        ),
    )

    @field_validator("database_url")
    @classmethod
    def _normalise_database_url(cls, value: str) -> str:
        # Accept the classic postgres:// forms that hosting providers hand out
        # and route them through the psycopg 3 driver.
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def public_url(self) -> str:
        """The externally reachable base URL for this backend.

        Hosting platforms inject their own URL, which saves configuring it by
        hand and keeps Hunar webhook callbacks correct on first deploy. An
        explicit PUBLIC_BACKEND_URL always wins.
        """
        if self.public_backend_url and self.public_backend_url != "http://localhost:8000":
            return self.public_backend_url
        for variable in ("RENDER_EXTERNAL_URL", "VERCEL_URL", "PUBLIC_URL"):
            value = os.environ.get(variable)
            if value:
                return value if value.startswith("http") else f"https://{value}"
        return self.public_backend_url

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def hunar_configured(self) -> bool:
        return bool(self.hunar_api_key)

    @property
    def live_voice_enabled(self) -> bool:
        """Real calls require both an API key and demo mode switched off."""
        return self.hunar_configured and not self.demo_mode


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
