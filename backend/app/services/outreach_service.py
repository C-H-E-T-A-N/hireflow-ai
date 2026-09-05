"""AI voice outreach lifecycle: queue -> call -> extract structured response."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.integrations.hunar.agents import build_outreach_blueprint
from app.integrations.hunar.base import VoiceCallSpec
from app.integrations.hunar.service import get_voice_provider, voice_mode
from app.integrations.llm.factory import get_llm_provider
from app.models.conversation import Conversation
from app.models.enums import (
    ActivityType,
    AvailabilityStatus,
    CandidateStage,
    ConversationChannel,
    ConversationStatus,
    InsightSeverity,
    InterestLevel,
    OutreachRecommendation,
    OutreachStatus,
)
from app.models.outreach import CandidateResponse, Outreach
from app.models.recruiting import Candidate, Job
from app.services import voice_service
from app.services.activity import add_insight, log_activity
from app.services.voice_policy import decide_for_candidate

COMPANY_NAME = "HireFlow"

ACTIVE_STATUSES = {OutreachStatus.DIALING, OutreachStatus.IN_PROGRESS, OutreachStatus.PROCESSING}


def get_outreach(db: Session, outreach_id: str) -> Outreach:
    outreach = db.get(Outreach, outreach_id)
    if outreach is None:
        raise NotFoundError(f"Outreach {outreach_id} was not found.")
    return outreach


def list_outreaches(
    db: Session, *, status: str | None = None, job_id: str | None = None, limit: int = 100
) -> list[Outreach]:
    stmt = select(Outreach).order_by(Outreach.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Outreach.status == status)
    if job_id:
        stmt = stmt.where(Outreach.job_id == job_id)
    return list(db.execute(stmt).scalars())


def create_outreach_batch(
    db: Session,
    *,
    job_id: str,
    candidate_ids: list[str],
    campaign_name: str | None = None,
    agent_persona_name: str = "Riya",
    talking_points: list[str] | None = None,
    language: str = "ENGLISH",
) -> list[Outreach]:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} was not found.")
    if not candidate_ids:
        raise ValidationError("Select at least one candidate to contact.")

    created: list[Outreach] = []
    for candidate_id in candidate_ids:
        candidate = db.get(Candidate, candidate_id)
        if candidate is None:
            raise NotFoundError(f"Candidate {candidate_id} was not found.")

        outreach = Outreach(
            job_id=job.id,
            candidate_id=candidate.id,
            campaign_name=campaign_name or f"{job.title} sourcing",
            agent_persona_name=agent_persona_name,
            language=language,
            talking_points=talking_points or _default_talking_points(job),
            status=OutreachStatus.QUEUED,
            queued_at=datetime.now(UTC),
        )
        db.add(outreach)
        created.append(outreach)

    db.commit()
    for outreach in created:
        db.refresh(outreach)
    return created


def _default_talking_points(job: Job) -> list[str]:
    points = [f"Role: {job.title}"]
    if job.location:
        points.append(f"Location: {job.location}")
    if job.required_skills:
        points.append(f"Core stack: {', '.join(list(job.required_skills)[:4])}")
    if job.salary_min and job.salary_max:
        points.append(f"Budget: {job.salary_currency} {job.salary_min:,} - {job.salary_max:,}")
    return points


def start_outreach(db: Session, outreach_id: str) -> Outreach:
    outreach = get_outreach(db, outreach_id)
    if outreach.status in ACTIVE_STATUSES:
        raise ConflictError("This outreach call is already in progress.")
    if outreach.status == OutreachStatus.COMPLETED:
        raise ConflictError("This outreach has already completed.")

    candidate = outreach.candidate
    job = outreach.job

    # A missing number is not an error: voice_policy downgrades the call to a
    # simulation so the workflow still completes and the recruiter still gets a
    # result. Only a live dial actually needs a valid number.

    blueprint = build_outreach_blueprint(
        job_title=job.title,
        company=COMPANY_NAME,
        persona_name=outreach.agent_persona_name,
        voice_persona=outreach.voice_persona,
        language=outreach.language,
        talking_points=list(outreach.talking_points or []),
    )

    from app.services.demo_scripts import build_outreach_script

    script, demo_result = build_outreach_script(
        candidate_id=candidate.id,
        candidate_name=candidate.full_name,
        current_title=candidate.current_title,
        current_company=candidate.current_company,
        location=candidate.location,
        experience_years=candidate.experience_years,
        skills=list(candidate.skills or []),
        job_title=job.title,
        company=COMPANY_NAME,
        persona_name=outreach.agent_persona_name,
        availability_hint=candidate.availability,
    )

    # Fabricated demo contact details are never dialled for real.
    decision = decide_for_candidate(candidate)

    spec = VoiceCallSpec(
        purpose="outreach",
        blueprint=blueprint,
        callee_name=candidate.full_name,
        mobile_number=candidate.phone or "",
        custom_data={
            "candidate_name": candidate.full_name,
            "current_title": candidate.current_title or "",
            "current_company": candidate.current_company or "",
            "location": candidate.location or "",
            "job_title": job.title,
        },
        request_id=f"outreach-{outreach.id}",
        allow_live=decision.allow_live,
        simulation_reason=decision.reason,
        demo_script=script,
        demo_result=demo_result,
    )

    state = get_voice_provider().place_call(spec)
    call = voice_service.persist_call(db, state)

    conversation = Conversation(
        channel=ConversationChannel.VOICE_OUTREACH,
        status=ConversationStatus.ACTIVE,
        title=f"Outreach - {candidate.full_name} - {job.title}",
        candidate_id=candidate.id,
        job_id=job.id,
        voice_call_id=call.id,
    )
    db.add(conversation)
    db.flush()

    outreach.voice_call_id = call.id
    outreach.conversation_id = conversation.id
    outreach.status = OutreachStatus.DIALING
    outreach.started_at = datetime.now(UTC)
    outreach.attempt_count += 1
    outreach.error_message = None

    if candidate.stage == CandidateStage.SOURCED:
        candidate.stage = CandidateStage.CONTACTED
    candidate.last_activity_at = datetime.now(UTC)

    log_activity(
        db,
        type=ActivityType.OUTREACH_STARTED,
        message=(
            f"AI outreach call started to {candidate.full_name} "
            f"({'live call' if voice_mode() == 'live' else 'demo simulation'})"
        ),
        candidate_id=candidate.id,
        job_id=job.id,
        meta={"outreach_id": outreach.id, "mode": voice_mode()},
    )
    db.commit()
    db.refresh(outreach)
    return outreach


def sync_outreach(db: Session, outreach_id: str, *, force_complete: bool = False) -> Outreach:
    outreach = get_outreach(db, outreach_id)
    if outreach.voice_call is None or outreach.conversation is None:
        return outreach
    if outreach.status in (OutreachStatus.COMPLETED, OutreachStatus.FAILED) and not force_complete:
        return outreach

    state = voice_service.refresh_call(db, outreach.voice_call, force_complete=force_complete)
    voice_service.sync_turns(db, outreach.conversation, state.turns)

    if state.status in ("RINGING", "INITIATED"):
        outreach.status = OutreachStatus.DIALING
    elif state.status == "IN_PROGRESS":
        outreach.status = OutreachStatus.IN_PROGRESS
    elif state.status == "COMPLETED":
        _complete_outreach(db, outreach, state.result or {})
    elif state.status == "NOT_CONNECTED":
        outreach.status = OutreachStatus.NO_ANSWER
        outreach.error_message = "The candidate did not answer."
        outreach.conversation.status = ConversationStatus.FAILED
    elif state.status in ("FAILED", "CANCELLED"):
        outreach.status = OutreachStatus.FAILED
        outreach.error_message = "The call failed at the telephony provider."
        outreach.conversation.status = ConversationStatus.FAILED

    db.commit()
    db.refresh(outreach)
    return outreach


def _complete_outreach(db: Session, outreach: Outreach, result: dict[str, Any]) -> None:
    outreach.status = OutreachStatus.PROCESSING
    outreach.conversation.status = ConversationStatus.ANALYZING
    db.flush()

    candidate = outreach.candidate
    response = outreach.response or CandidateResponse(outreach_id=outreach.id)

    response.interest_level = _normalise_enum(
        result.get("interest_level"), InterestLevel, InterestLevel.UNKNOWN
    )
    response.current_role = result.get("current_role") or candidate.current_title
    response.current_company = result.get("current_company") or candidate.current_company
    response.experience_years = _as_float(result.get("experience_years"))
    response.current_location = result.get("current_location") or candidate.location
    response.notice_period_days = _as_int(result.get("notice_period_days"))
    response.expected_compensation = result.get("expected_compensation")
    response.relevant_skills = _as_list(result.get("relevant_skills"))
    response.availability = result.get("availability")
    response.reason_for_interest = result.get("reason_for_interest")
    response.open_to_relocate = _as_bool(result.get("open_to_relocate"))
    response.ai_recommendation = _normalise_enum(
        result.get("recommendation"), OutreachRecommendation, OutreachRecommendation.PENDING
    )
    response.raw_result = result

    summary = get_llm_provider().summarise_conversation(
        {
            "candidate_name": candidate.full_name,
            "job_title": outreach.job.title,
            "interest_level": response.interest_level,
            "notice_period_days": response.notice_period_days,
            "current_location": response.current_location,
            "expected_compensation": response.expected_compensation,
            "reason_for_interest": response.reason_for_interest,
            "transcript": [
                {"speaker": turn.speaker, "content": turn.content}
                for turn in outreach.conversation.turns
            ],
        }
    )
    response.ai_summary = summary.get("summary")
    response.confidence = 0.9 if response.interest_level != InterestLevel.UNKNOWN else 0.4

    if outreach.response is None:
        db.add(response)

    outreach.status = OutreachStatus.COMPLETED
    outreach.completed_at = datetime.now(UTC)
    outreach.conversation.status = ConversationStatus.COMPLETED
    outreach.conversation.summary = response.ai_summary
    outreach.conversation.sentiment = summary.get("sentiment")
    outreach.conversation.extracted_data = {
        "interest_level": response.interest_level,
        "current_role": response.current_role,
        "experience_years": response.experience_years,
        "current_location": response.current_location,
        "notice_period_days": response.notice_period_days,
        "expected_compensation": response.expected_compensation,
        "relevant_skills": response.relevant_skills,
        "availability": response.availability,
        "reason_for_interest": response.reason_for_interest,
        "recommendation": response.ai_recommendation,
    }

    # Move the candidate through the pipeline based on what they actually said.
    if response.interest_level == InterestLevel.INTERESTED:
        candidate.stage = CandidateStage.INTERESTED
    elif response.interest_level == InterestLevel.NOT_INTERESTED:
        candidate.stage = CandidateStage.NOT_INTERESTED
    else:
        candidate.stage = CandidateStage.CONTACTED

    if response.notice_period_days is not None:
        candidate.notice_period_days = response.notice_period_days
        candidate.availability = _availability_from_notice(response.notice_period_days)
    if response.expected_compensation:
        candidate.expected_ctc = response.expected_compensation
    candidate.last_activity_at = datetime.now(UTC)

    log_activity(
        db,
        type=ActivityType.OUTREACH_COMPLETED,
        message=(
            f"{candidate.full_name} is {response.interest_level.replace('_', ' ')} "
            f"in {outreach.job.title}"
        ),
        candidate_id=candidate.id,
        job_id=outreach.job_id,
        meta={"outreach_id": outreach.id, "interest": response.interest_level},
    )

    if response.ai_recommendation == OutreachRecommendation.HIGH_POTENTIAL:
        add_insight(
            db,
            title=f"{candidate.full_name} is a high-potential lead",
            body=(
                f"Interested in {outreach.job.title}, "
                f"{response.notice_period_days or 'unknown'} day notice. Book an interview."
            ),
            severity=InsightSeverity.POSITIVE,
            action_label="Schedule interview",
            action_href=f"/candidates/{candidate.id}",
            candidate_id=candidate.id,
            job_id=outreach.job_id,
        )


def _availability_from_notice(days: int) -> str:
    if days <= 15:
        return AvailabilityStatus.IMMEDIATE
    if days <= 30:
        return AvailabilityStatus.ONE_MONTH
    if days <= 60:
        return AvailabilityStatus.TWO_MONTHS
    return AvailabilityStatus.THREE_MONTHS_PLUS


def _normalise_enum(value: Any, enum_cls: type, default: str) -> str:
    allowed = {item.value for item in enum_cls}
    text = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return text if text in allowed else default


def _as_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _as_int(value: Any) -> int | None:
    try:
        return int(float(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _as_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    if text in {"true", "yes", "1"}:
        return True
    if text in {"false", "no", "0"}:
        return False
    return None


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return []
