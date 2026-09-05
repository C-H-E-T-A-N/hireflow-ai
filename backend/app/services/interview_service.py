"""AI interview lifecycle: configure -> generate questions -> run -> evaluate."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.integrations.hunar.agents import build_interview_blueprint
from app.integrations.hunar.base import VoiceCallSpec
from app.integrations.hunar.service import get_voice_provider, voice_mode
from app.integrations.llm.factory import get_llm_provider
from app.models.conversation import Conversation
from app.models.enums import (
    ActivityType,
    CandidateStage,
    ConversationChannel,
    ConversationStatus,
    InsightSeverity,
    InterviewStatus,
    Recommendation,
)
from app.models.interview import Interview, InterviewAnswer, InterviewQuestion
from app.models.recruiting import Candidate, Job
from app.services import voice_service
from app.services.activity import add_insight, log_activity
from app.services.demo_scripts import build_interview_script
from app.services.question_bank import GeneratedQuestion, generate_questions
from app.services.voice_policy import decide_for_candidate

COMPANY_NAME = "HireFlow"

ACTIVE_STATUSES = {
    InterviewStatus.DIALING,
    InterviewStatus.IN_PROGRESS,
    InterviewStatus.PROCESSING,
}


def get_interview(db: Session, interview_id: str) -> Interview:
    interview = db.get(Interview, interview_id)
    if interview is None:
        raise NotFoundError(f"Interview {interview_id} was not found.")
    return interview


def list_interviews(
    db: Session, *, status: str | None = None, job_id: str | None = None, limit: int = 100
) -> list[Interview]:
    stmt = select(Interview).order_by(Interview.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Interview.status == status)
    if job_id:
        stmt = stmt.where(Interview.job_id == job_id)
    return list(db.execute(stmt).scalars())


def create_interview(
    db: Session,
    *,
    job_id: str,
    candidate_id: str,
    title: str | None = None,
    interview_type: str = "technical",
    difficulty: str = "intermediate",
    duration_minutes: int = 30,
    focus_areas: list[str] | None = None,
    language: str = "ENGLISH",
    agent_persona_name: str = "Aria",
    scheduled_at: datetime | None = None,
    notes: str | None = None,
) -> Interview:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} was not found.")
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise NotFoundError(f"Candidate {candidate_id} was not found.")

    # Default the focus to the job's own required skills.
    areas = focus_areas or list(job.required_skills or [])[:4]
    if not areas:
        raise ValidationError(
            "At least one focus area is required, and the job has no parsed skills to fall back on."
        )

    interview = Interview(
        job_id=job.id,
        candidate_id=candidate.id,
        title=title or f"{job.title} - {interview_type.replace('_', ' ').title()} Interview",
        interview_type=interview_type,
        difficulty=difficulty,
        duration_minutes=duration_minutes,
        focus_areas=areas,
        language=language,
        agent_persona_name=agent_persona_name,
        voice_persona=settings.hunar_default_voice_persona,
        status=InterviewStatus.SCHEDULED if scheduled_at else InterviewStatus.DRAFT,
        scheduled_at=scheduled_at,
        notes=notes,
        intro_message=(
            f"Hi {candidate.full_name.split()[0]}, this is {agent_persona_name} from "
            f"{COMPANY_NAME}. I will be running your {interview_type} interview for the "
            f"{job.title} role."
        ),
    )
    db.add(interview)
    db.flush()

    for index, question in enumerate(
        generate_questions(
            focus_areas=areas,
            difficulty=difficulty,
            interview_type=interview_type,
            duration_minutes=duration_minutes,
        )
    ):
        db.add(
            InterviewQuestion(
                interview_id=interview.id,
                sequence=index,
                prompt=question.prompt,
                focus_area=question.focus_area,
                competency=question.competency,
                expected_signals=question.expected_signals,
                weight=question.weight,
            )
        )

    if candidate.stage in (
        CandidateStage.SOURCED,
        CandidateStage.CONTACTED,
        CandidateStage.INTERESTED,
    ):
        candidate.stage = CandidateStage.INTERVIEW_SCHEDULED
    candidate.last_activity_at = datetime.now(UTC)

    log_activity(
        db,
        type=ActivityType.INTERVIEW_CREATED,
        message=f"AI interview configured for {candidate.full_name} - {job.title}",
        actor="Recruiter",
        candidate_id=candidate.id,
        job_id=job.id,
    )
    db.commit()
    db.refresh(interview)
    return interview


def start_interview(db: Session, interview_id: str) -> Interview:
    interview = get_interview(db, interview_id)
    if interview.status in ACTIVE_STATUSES:
        raise ConflictError("This interview is already running.")
    if interview.status == InterviewStatus.COMPLETED:
        raise ConflictError("This interview has already been completed.")

    candidate = interview.candidate
    job = interview.job

    # A missing number is not an error: voice_policy downgrades the call to a
    # simulation so the workflow still completes and the recruiter still gets a
    # result. Only a live dial actually needs a valid number.

    blueprint = build_interview_blueprint(
        job_title=job.title,
        company=COMPANY_NAME,
        interview_type=interview.interview_type,
        difficulty=interview.difficulty,
        duration_minutes=interview.duration_minutes,
        focus_areas=list(interview.focus_areas or []),
        persona_name=interview.agent_persona_name,
        voice_persona=interview.voice_persona,
        language=interview.language,
    )

    questions = [
        GeneratedQuestion(
            prompt=q.prompt,
            focus_area=q.focus_area or "General",
            competency=q.competency or "Technical Depth",
            expected_signals=list(q.expected_signals or []),
            weight=q.weight,
        )
        for q in interview.questions
    ]

    script, demo_result, _ = build_interview_script(
        candidate_id=candidate.id,
        candidate_name=candidate.full_name,
        candidate_company=candidate.current_company,
        job_title=job.title,
        company=COMPANY_NAME,
        persona_name=interview.agent_persona_name,
        questions=questions,
    )

    # Fabricated demo contact details are never dialled for real.
    decision = decide_for_candidate(candidate)

    spec = VoiceCallSpec(
        purpose="interview",
        blueprint=blueprint,
        callee_name=candidate.full_name,
        mobile_number=candidate.phone or "",
        custom_data={
            "candidate_name": candidate.full_name,
            "job_title": job.title,
            "focus_areas": ", ".join(interview.focus_areas or []),
        },
        request_id=f"interview-{interview.id}",
        allow_live=decision.allow_live,
        simulation_reason=decision.reason,
        demo_script=script,
        demo_result=demo_result,
    )

    state = get_voice_provider().place_call(spec)
    call = voice_service.persist_call(db, state)

    conversation = Conversation(
        channel=ConversationChannel.VOICE_INTERVIEW,
        status=ConversationStatus.ACTIVE,
        title=f"{interview.title} - {candidate.full_name}",
        candidate_id=candidate.id,
        job_id=job.id,
        voice_call_id=call.id,
    )
    db.add(conversation)
    db.flush()

    interview.voice_call_id = call.id
    interview.conversation_id = conversation.id
    interview.status = InterviewStatus.DIALING
    interview.started_at = datetime.now(UTC)
    interview.current_question_index = 0
    interview.error_message = None

    log_activity(
        db,
        type=ActivityType.INTERVIEW_STARTED,
        message=(
            f"AI interview started with {candidate.full_name} "
            f"({'live call' if voice_mode() == 'live' else 'demo simulation'})"
        ),
        candidate_id=candidate.id,
        job_id=job.id,
        meta={"interview_id": interview.id, "mode": voice_mode()},
    )
    db.commit()
    db.refresh(interview)
    return interview


def sync_interview(db: Session, interview_id: str, *, force_complete: bool = False) -> Interview:
    """Advance an in-flight interview.

    Pulls the latest provider state, stores any new turns, and evaluates the
    interview once the call completes.
    """
    interview = get_interview(db, interview_id)
    if interview.voice_call is None or interview.conversation is None:
        return interview
    if (
        interview.status in (InterviewStatus.COMPLETED, InterviewStatus.FAILED)
        and not force_complete
    ):
        return interview

    state = voice_service.refresh_call(db, interview.voice_call, force_complete=force_complete)
    provider = get_voice_provider()
    turns = state.turns or provider.refresh_call(voice_service.to_state(interview.voice_call)).turns
    voice_service.sync_turns(db, interview.conversation, turns)

    # Track which question the agent is currently on.
    asked = [turn for turn in turns if turn.speaker == "agent" and "question_index" in turn.meta]
    if asked:
        interview.current_question_index = int(asked[-1].meta["question_index"])

    if state.status in ("RINGING", "INITIATED"):
        interview.status = InterviewStatus.DIALING
    elif state.status == "IN_PROGRESS":
        interview.status = InterviewStatus.IN_PROGRESS
    elif state.status == "COMPLETED":
        _complete_interview(db, interview, state.result or {})
    elif state.status in ("FAILED", "NOT_CONNECTED", "CANCELLED"):
        interview.status = InterviewStatus.FAILED
        interview.error_message = {
            "NOT_CONNECTED": "The candidate did not answer the call.",
            "CANCELLED": "The call was cancelled.",
            "FAILED": "The call failed at the telephony provider.",
        }.get(state.status, "The call did not complete.")
        interview.conversation.status = ConversationStatus.FAILED

    db.commit()
    db.refresh(interview)
    return interview


def _complete_interview(db: Session, interview: Interview, result: dict) -> None:
    interview.status = InterviewStatus.PROCESSING
    interview.conversation.status = ConversationStatus.ANALYZING
    db.flush()

    answers = _collect_answers(db, interview, result)
    evaluation = get_llm_provider().evaluate_interview(
        {
            "job_title": interview.job.title,
            "candidate_name": interview.candidate.full_name,
            "difficulty": interview.difficulty,
            "focus_areas": interview.focus_areas,
            "answers": answers,
        }
    )

    interview.overall_score = _score(evaluation.get("overall_score"))
    interview.technical_score = _score(evaluation.get("technical_score"))
    interview.communication_score = _score(evaluation.get("communication_score"))
    interview.problem_solving_score = _score(evaluation.get("problem_solving_score"))
    interview.role_fit_score = _score(evaluation.get("role_fit_score"))
    interview.recommendation = _normalise_recommendation(evaluation.get("recommendation"))
    interview.evaluation_summary = evaluation.get("summary")
    interview.strengths = list(evaluation.get("strengths") or [])
    interview.concerns = list(evaluation.get("concerns") or [])
    interview.evaluation_detail = evaluation
    interview.status = InterviewStatus.COMPLETED
    interview.completed_at = datetime.now(UTC)

    interview.conversation.status = ConversationStatus.COMPLETED
    interview.conversation.summary = evaluation.get("summary")
    interview.conversation.extracted_data = {
        "overall_score": interview.overall_score,
        "recommendation": interview.recommendation,
        "strengths": interview.strengths,
        "concerns": interview.concerns,
        "per_competency": evaluation.get("per_competency", {}),
    }

    candidate = interview.candidate
    candidate.last_activity_at = datetime.now(UTC)
    if interview.recommendation in (Recommendation.STRONG_HIRE, Recommendation.SHORTLIST):
        candidate.stage = CandidateStage.SHORTLISTED
    elif interview.recommendation == Recommendation.REJECT:
        candidate.stage = CandidateStage.REJECTED
    else:
        candidate.stage = CandidateStage.INTERVIEW_COMPLETED

    log_activity(
        db,
        type=ActivityType.INTERVIEW_COMPLETED,
        message=(
            f"Interview completed for {candidate.full_name} - scored "
            f"{interview.overall_score:g}/100"
            if interview.overall_score is not None
            else f"Interview completed for {candidate.full_name}"
        ),
        candidate_id=candidate.id,
        job_id=interview.job_id,
        meta={"interview_id": interview.id, "recommendation": interview.recommendation},
    )

    if interview.overall_score is not None and interview.overall_score >= 80:
        add_insight(
            db,
            title=f"{candidate.full_name} scored {interview.overall_score:g}/100",
            body=(
                f"Strong interview for {interview.job.title}. "
                f"AI recommendation: {interview.recommendation.replace('_', ' ')}."
            ),
            severity=InsightSeverity.POSITIVE,
            action_label="Review scorecard",
            action_href=f"/interviews/{interview.id}",
            candidate_id=candidate.id,
            job_id=interview.job_id,
        )


def _collect_answers(db: Session, interview: Interview, result: dict) -> list[dict]:
    """Attach each candidate utterance to the question that prompted it."""
    turns = interview.conversation.turns if interview.conversation else []
    by_index: dict[int, str] = {}
    for turn in turns:
        if turn.speaker != "candidate":
            continue
        index = turn.meta.get("question_index") if turn.meta else None
        if index is None:
            continue
        by_index[int(index)] = turn.content

    # A live Hunar call may return answers in the structured result instead.
    for item in result.get("answers", []) or []:
        if isinstance(item, dict) and item.get("question_index") is not None:
            by_index.setdefault(int(item["question_index"]), item.get("transcript", ""))

    answers: list[dict] = []
    for question in interview.questions:
        transcript = by_index.get(question.sequence, "")
        record = db.execute(
            select(InterviewAnswer).where(InterviewAnswer.question_id == question.id)
        ).scalar_one_or_none()
        if record is None:
            record = InterviewAnswer(question_id=question.id)
            db.add(record)
        record.transcript = transcript
        record.answered_at = datetime.now(UTC) if transcript else None
        record.signals_detected = [
            signal
            for signal in (question.expected_signals or [])
            if signal.lower() in transcript.lower()
        ]
        answers.append(
            {
                "question_index": question.sequence,
                "prompt": question.prompt,
                "transcript": transcript,
                "expected_signals": list(question.expected_signals or []),
                "competency": question.competency,
                "focus_area": question.focus_area,
            }
        )

    db.flush()
    # Score each stored answer from its own signal coverage, for the detail view.
    for question, payload in zip(interview.questions, answers, strict=False):
        if question.answer is None:
            continue
        expected = payload["expected_signals"]
        detected = question.answer.signals_detected or []
        question.answer.score = round(len(detected) / len(expected) * 100, 1) if expected else None
    db.flush()
    return answers


def _score(value: object) -> float | None:
    try:
        return round(float(value), 1) if value is not None else None
    except (TypeError, ValueError):
        return None


def _normalise_recommendation(value: object) -> str:
    allowed = {item.value for item in Recommendation}
    text = str(value or "").strip().lower().replace(" ", "_")
    return text if text in allowed else Recommendation.PENDING
