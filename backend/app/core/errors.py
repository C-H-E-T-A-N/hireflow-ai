"""Domain errors plus the handlers that turn them into safe API responses.

Internal exception detail is never leaked to the client; unexpected errors are
logged server side and reported as a generic 500.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for expected, client-safe application errors."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ValidationError(AppError):
    # Literal rather than the starlette constant, whose name differs across versions.
    status_code = 422
    code = "validation_error"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class IntegrationError(AppError):
    """An upstream provider (Hunar, people search, LLM) failed."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "integration_error"


class ConfigurationError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "configuration_error"


def _payload(code: str, message: str, details: object = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_payload(
                "validation_error",
                "The request payload failed validation.",
                jsonable_encoder(exc.errors()),
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload("http_error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload(
                "internal_error",
                "Something went wrong while processing the request.",
            ),
        )
