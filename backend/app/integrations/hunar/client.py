"""Thin, faithful HTTP client for the Hunar Voice Agents external API.

Every method maps 1:1 onto a documented endpoint. No endpoint is invented; the
higher-level orchestration lives in `service.py`.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import ConfigurationError, IntegrationError
from app.core.logging import get_logger
from app.integrations.hunar.models import (
    AgentCreateRequest,
    AgentResource,
    CallCreateRequest,
    CallResource,
    PaginatedResponse,
    PhoneNumberResource,
)

logger = get_logger(__name__)


class HunarClient:
    """Authenticated client. The API key is injected from server-side settings only."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self._api_key = api_key or settings.hunar_api_key
        self._base_url = (base_url or settings.hunar_base_url).rstrip("/")
        self._timeout = timeout or settings.hunar_timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise ConfigurationError(
                "HUNAR_API_KEY is not configured on the server. "
                "Set it in backend/.env to place live calls."
            )
        return {"X-API-Key": self._api_key, "Content-Type": "application/json"}

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        url = f"{self._base_url}/{path.lstrip('/')}"
        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.request(
                    method, url, headers=self._headers(), params=params, json=json
                )
        except httpx.HTTPError as exc:
            logger.warning("Hunar request failed: %s %s (%s)", method, path, exc)
            raise IntegrationError(
                "Unable to reach the Hunar voice platform. Please retry shortly."
            ) from exc

        if response.status_code >= 400:
            raise self._to_error(response)
        if not response.content:
            return None
        return response.json()

    @staticmethod
    def _to_error(response: httpx.Response) -> IntegrationError:
        """Normalise the documented Hunar error envelope into an AppError."""
        message = "The Hunar voice platform rejected the request."
        details: dict[str, Any] = {}
        try:
            payload = response.json()
            message = payload.get("message") or message
            details = {"details": payload.get("details", [])}
        except ValueError:
            pass

        friendly = {
            401: "Hunar rejected the API key. Check HUNAR_API_KEY on the backend.",
            402: "The Hunar subscription is expired or out of calling minutes.",
            404: "The requested Hunar resource does not exist.",
        }
        error = IntegrationError(friendly.get(response.status_code, message), details=details)
        error.status_code = 502 if response.status_code >= 500 else response.status_code
        logger.warning("Hunar API error %s: %s", response.status_code, message)
        return error

    # --- Agents --------------------------------------------------------------

    def list_agents(self, page: int = 1, page_size: int = 20) -> PaginatedResponse:
        data = self._request("GET", "/agents/", params={"page": page, "page_size": page_size})
        return PaginatedResponse.model_validate(data or {})

    def get_agent(self, agent_id: str) -> AgentResource:
        data = self._request("GET", f"/agents/{agent_id}/")
        return AgentResource.model_validate(data)

    def create_agent(self, payload: AgentCreateRequest) -> AgentResource:
        data = self._request(
            "POST", "/agents/", json=payload.model_dump(exclude_none=True, mode="json")
        )
        return AgentResource.model_validate(data)

    def update_agent(self, agent_id: str, payload: dict[str, Any]) -> AgentResource:
        data = self._request("PUT", f"/agents/{agent_id}/", json=payload)
        return AgentResource.model_validate(data)

    # --- Calls ---------------------------------------------------------------

    def create_call(self, payload: CallCreateRequest) -> CallResource:
        data = self._request(
            "POST", "/calls/", json=payload.model_dump(exclude_none=True, mode="json")
        )
        return CallResource.model_validate(data)

    def create_bulk_calls(self, payload: dict[str, Any]) -> list[CallResource]:
        data = self._request("POST", "/calls/bulk/", json=payload)
        return [CallResource.model_validate(item) for item in (data or [])]

    def get_call(self, call_id: str) -> CallResource:
        data = self._request("GET", f"/calls/{call_id}/")
        return CallResource.model_validate(data)

    def list_calls(
        self,
        *,
        agent_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse:
        params: dict[str, Any] = {"page": page, "page_size": page_size}
        if agent_id:
            params["agent_id"] = agent_id
        if status:
            params["status"] = status
        data = self._request("GET", "/calls/", params=params)
        return PaginatedResponse.model_validate(data or {})

    # --- Phone numbers -------------------------------------------------------

    def list_numbers(self, page: int = 1, page_size: int = 20) -> list[PhoneNumberResource]:
        data = self._request("GET", "/numbers/", params={"page": page, "page_size": page_size})
        results = (data or {}).get("results", [])
        return [PhoneNumberResource.model_validate(item) for item in results]
