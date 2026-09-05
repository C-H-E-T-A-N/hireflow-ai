from __future__ import annotations

from app.core.config import settings
from app.core.errors import ConfigurationError
from app.core.logging import get_logger
from app.integrations.people_search.base import PeopleSearchProvider
from app.integrations.people_search.mock_provider import MockPeopleSearchProvider
from app.integrations.people_search.pdl_provider import PDLPeopleSearchProvider

logger = get_logger(__name__)

# Register additional vendors (Apollo, Proxycurl, an internal index) here.
_REGISTRY = {
    "mock": MockPeopleSearchProvider,
    "pdl": PDLPeopleSearchProvider,
}


def get_people_search_provider(name: str | None = None) -> PeopleSearchProvider:
    key = (name or settings.people_search_provider or "mock").lower()
    provider_cls = _REGISTRY.get(key)
    if provider_cls is None:
        raise ConfigurationError(
            f"Unknown people-search provider '{key}'. "
            f"Available providers: {', '.join(sorted(_REGISTRY))}."
        )
    if key == "pdl" and not settings.pdl_api_key:
        raise ConfigurationError(
            "PEOPLE_SEARCH_PROVIDER=pdl requires PDL_API_KEY to be set on the backend."
        )
    return provider_cls()


def available_providers() -> list[str]:
    return sorted(_REGISTRY)
