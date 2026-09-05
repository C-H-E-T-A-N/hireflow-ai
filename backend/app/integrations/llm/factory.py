from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.llm.anthropic_provider import AnthropicLLMProvider
from app.integrations.llm.base import LLMProvider
from app.integrations.llm.heuristic import HeuristicLLMProvider

logger = get_logger(__name__)


def get_llm_provider() -> LLMProvider:
    """Anthropic when configured, otherwise the deterministic engine."""
    if settings.llm_provider.lower() == "anthropic":
        if settings.anthropic_api_key:
            return AnthropicLLMProvider()
        logger.warning(
            "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset; using heuristic engine."
        )
    return HeuristicLLMProvider()


def active_llm_engine() -> str:
    return get_llm_provider().name
