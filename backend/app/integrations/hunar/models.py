"""Typed mirror of the Hunar Voice Agents external API contract.

Source: https://api.voice.hunar.ai/docs/external/  (base https://api.voice.hunar.ai/external/v1)
Field names below match the documented request/response payloads exactly - the
translation into HireFlow's own vocabulary happens in `service.py`, never here.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HunarLanguage(StrEnum):
    ENGLISH = "ENGLISH"
    HINDI = "HINDI"
    TAMIL = "TAMIL"
    TELUGU = "TELUGU"
    KANNADA = "KANNADA"
    MARATHI = "MARATHI"
    MALAYALAM = "MALAYALAM"
    GUJARATI = "GUJARATI"
    BENGALI = "BENGALI"
    TURKISH = "TURKISH"
    ARABIC = "ARABIC"
    SPANISH = "SPANISH"


class HunarCallStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    SCHEDULED = "SCHEDULED"
    INITIATED = "INITIATED"
    RINGING = "RINGING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NOT_CONNECTED = "NOT_CONNECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


TERMINAL_CALL_STATUSES = {
    HunarCallStatus.COMPLETED,
    HunarCallStatus.NOT_CONNECTED,
    HunarCallStatus.CANCELLED,
    HunarCallStatus.FAILED,
}


class RetryConfig(BaseModel):
    """Both fields are mandatory together - partial objects are rejected upstream.

    `retry_interval_hours` must be 0 (with max_retry_count 0) or one of 3/6/9/12/24.
    """

    max_retry_count: int = Field(ge=0, le=10)
    retry_interval_hours: int


class Guardrails(BaseModel):
    allowed_days: list[str] | None = None
    earliest_call_time: str | None = None
    last_call_time: str | None = None


class CallbackConfig(BaseModel):
    call_status_callback_url: str | None = None
    call_recording_callback_url: str | None = None
    call_result_callback_url: str | None = None
    call_summary_callback_url: str | None = None


class AgentCreateRequest(BaseModel):
    name: str
    language: HunarLanguage = HunarLanguage.ENGLISH
    voice_persona: str
    persona_name: str | None = None
    agent_prompt: str
    objective: str | None = None
    introduction: str
    # `result_prompt` and `result_schema` must always be supplied together.
    result_prompt: str | None = None
    result_schema: dict[str, Any] | None = None


class AgentResource(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    voice_persona: str | None = None
    persona_name: str | None = None
    voice_name: str | None = None
    language: str | None = None
    summary: str | None = None
    status: str | None = None
    logo: str | None = None
    agent_code: str | None = None
    custom_variables: list[str] = Field(default_factory=list)
    required_variables: list[str] = Field(default_factory=list)
    result_variables: list[str] = Field(default_factory=list)
    result_schema: dict[str, Any] | None = None
    agent_prompt: str | None = None
    introduction: str | None = None
    objective: str | None = None
    silence_response: str | None = None
    conclusion: str | None = None
    result_prompt: str | None = None
    created_at: str | None = None


class CallCreateRequest(BaseModel):
    agent_id: str
    callee_name: str
    mobile_number: str
    custom_data: dict[str, Any] | None = None
    from_phone_number: str | None = None
    request_id: str | None = None
    retry_config: RetryConfig | None = None
    guardrails: Guardrails | None = None
    timezone: str | None = None
    callback_config: CallbackConfig | None = None


class CallResource(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    request_id: str | None = None
    status: str | None = None
    lifecycle_status: str | None = None
    callee_name: str | None = None
    mobile_number: str | None = None
    from_phone_number: str | None = None
    agent_id: str | None = None
    language: str | None = None
    custom_data: dict[str, Any] = Field(default_factory=dict)
    system_data: dict[str, Any] = Field(default_factory=dict)
    recording_url: str | None = None
    # Structured extraction produced from the agent's `result_schema`.
    result: dict[str, Any] | None = None
    duration_minutes: float | None = None
    duration_seconds: float | None = None
    user_speech_duration: float | None = None
    engagement_status: str | None = None
    answered_by: str | None = None
    call_ended_by: str | None = None
    max_retries: int | None = None
    retry_count: int | None = None
    retries_left: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    started_at: str | None = None
    ended_at: str | None = None
    triggered_by: str | None = None


class PhoneNumberResource(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    phone_number: str
    allowed_countries: list[str] = Field(default_factory=list)
    country_code: str | None = None
    is_default: bool = False
    is_validated: bool = False
    provider: str | None = None


class PaginatedResponse(BaseModel):
    count: int = 0
    next: str | None = None
    previous: str | None = None
    results: list[dict[str, Any]] = Field(default_factory=list)


class HunarWebhookEvent(BaseModel):
    """Payload delivered to the URLs registered in `callback_config`."""

    model_config = ConfigDict(extra="allow")

    event_type: str | None = None
    call_id: str | None = None
    agent_id: str | None = None
    request_id: str | None = None
    to_number: str | None = None
    from_phone_number: str | None = None
    status: str | None = None
    lifecycle_status: str | None = None
    answered_by: str | None = None
    duration_seconds: float | None = None
    duration_minutes: float | None = None
    recording_url: str | None = None
    result: dict[str, Any] | None = None
    started_at: str | None = None
    ended_at: str | None = None
