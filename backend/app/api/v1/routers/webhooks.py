"""Inbound webhooks from the Hunar voice platform.

Hunar pushes call status, recording and result events to the URLs registered in
`callback_config` when the call is created. Deliveries are HMAC-verified before
anything is written.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.logging import get_logger
from app.db.session import get_db
from app.integrations.hunar.models import HunarWebhookEvent
from app.integrations.hunar.webhooks import verify_signature
from app.models.conversation import VoiceCall
from app.models.interview import Interview
from app.models.outreach import Outreach
from app.services import interview_service, outreach_service

logger = get_logger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/hunar")
async def hunar_webhook(
    request: Request,
    x_hunar_signature: str | None = Header(default=None, alias="X-Hunar-Signature"),
    x_hunar_timestamp: str | None = Header(default=None, alias="X-Hunar-Timestamp"),
    db: Session = Depends(get_db),
) -> JSONResponse:
    body = await request.body()

    if not verify_signature(body, x_hunar_signature, x_hunar_timestamp):
        logger.warning("Rejected a Hunar webhook with an invalid signature.")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": {"code": "invalid_signature", "message": "Signature check failed."}},
        )

    try:
        event = HunarWebhookEvent.model_validate_json(body)
    except ValueError:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {"code": "invalid_payload", "message": "Malformed webhook body."}},
        )

    if not event.call_id:
        return JSONResponse(status_code=200, content={"received": True, "matched": False})

    matched = await run_in_threadpool(_apply_event, db, event)
    return JSONResponse(status_code=200, content={"received": True, "matched": matched})


def _apply_event(db: Session, event: HunarWebhookEvent) -> bool:
    """Persist the event, then re-run the owning service's state machine.

    Webhook-driven and poll-driven updates therefore follow the identical path.
    """
    call = db.execute(
        select(VoiceCall).where(VoiceCall.provider_call_id == event.call_id)
    ).scalar_one_or_none()
    if call is None:
        logger.info("Hunar webhook for unknown call %s ignored.", event.call_id)
        return False

    if event.status:
        call.status = event.status
    if event.lifecycle_status:
        call.lifecycle_status = event.lifecycle_status
    if event.recording_url:
        call.recording_url = event.recording_url
    if event.result:
        call.result = event.result
    if event.duration_seconds is not None:
        call.duration_seconds = event.duration_seconds
    db.commit()

    interview = db.execute(
        select(Interview).where(Interview.voice_call_id == call.id)
    ).scalar_one_or_none()
    if interview is not None:
        interview_service.sync_interview(db, interview.id)
        return True

    outreach = db.execute(
        select(Outreach).where(Outreach.voice_call_id == call.id)
    ).scalar_one_or_none()
    if outreach is not None:
        outreach_service.sync_outreach(db, outreach.id)
        return True

    return True
