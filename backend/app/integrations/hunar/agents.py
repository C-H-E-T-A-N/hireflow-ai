"""Hunar agent blueprints.

A blueprint is everything Hunar needs to stand up a voice agent: the prompt, the
introduction, and - critically - the `result_schema` that defines the structured
data we get back at the end of a call. The same schema is what the demo provider
fills in, so live and demo runs produce identical downstream records.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.integrations.hunar.models import AgentCreateRequest, HunarLanguage


@dataclass(slots=True)
class AgentBlueprint:
    name: str
    agent_prompt: str
    introduction: str
    objective: str
    result_prompt: str
    result_schema: dict[str, Any]
    persona_name: str = "Aria"
    voice_persona: str = "NEHA"
    language: str = "ENGLISH"
    custom_variables: list[str] = field(default_factory=list)

    def to_create_request(self) -> AgentCreateRequest:
        return AgentCreateRequest(
            name=self.name,
            language=HunarLanguage(self.language),
            voice_persona=self.voice_persona,
            persona_name=self.persona_name,
            agent_prompt=self.agent_prompt,
            objective=self.objective,
            introduction=self.introduction,
            result_prompt=self.result_prompt,
            result_schema=self.result_schema,
        )


# Structured extraction contract for a screening/outreach call. Keys map onto
# the columns of `candidate_responses`.
OUTREACH_RESULT_SCHEMA: dict[str, Any] = {
    "interest_level": "",
    "current_role": "",
    "current_company": "",
    "experience_years": "",
    "current_location": "",
    "notice_period_days": "",
    "expected_compensation": "",
    "relevant_skills": "",
    "availability": "",
    "reason_for_interest": "",
    "open_to_relocate": "",
    "summary": "",
    "recommendation": "",
}

# Structured extraction contract for an AI interview. Keys map onto the score
# columns of `interviews`.
INTERVIEW_RESULT_SCHEMA: dict[str, Any] = {
    "technical_score": "",
    "communication_score": "",
    "problem_solving_score": "",
    "role_fit_score": "",
    "overall_score": "",
    "strengths": "",
    "concerns": "",
    "recommendation": "",
    "summary": "",
}


def build_outreach_blueprint(
    *,
    job_title: str,
    company: str,
    persona_name: str = "Riya",
    voice_persona: str = "NEHA",
    language: str = "ENGLISH",
    talking_points: list[str] | None = None,
) -> AgentBlueprint:
    points = talking_points or []
    points_block = "\n".join(f"- {point}" for point in points) or "- Nothing additional."

    prompt = (
        "You are {persona_name}, a warm and efficient technical recruiter calling on behalf of "
        f"{company} about a {job_title} opening.\n\n"
        "Rules of the conversation:\n"
        "1. Confirm you are speaking to the right person before saying anything about the role.\n"
        "2. Ask permission to continue and respect a no immediately.\n"
        "3. Keep the call under four minutes. One question at a time. Never interrupt.\n"
        "4. Cover, in this order: interest in the role, current role and company, total years of "
        "experience, current city, notice period, expected compensation, and the skills they use "
        "day to day.\n"
        "5. If the candidate declines to share compensation, move on without pressing.\n"
        "6. Close by explaining the next step and thanking them.\n\n"
        "Points worth mentioning if the candidate asks about the role:\n"
        f"{points_block}\n\n"
        "Candidate context available to you: {candidate_name}, currently {current_title} at "
        "{current_company} in {location}."
    )

    introduction = (
        "Hi, am I speaking with {callee_name}? This is {persona_name} calling from "
        f"{company} about a {job_title} role. Do you have two minutes?"
    )

    result_prompt = (
        "Read the conversation and extract the candidate's answers. "
        "interest_level must be exactly one of: interested, not_interested, maybe_later, unknown. "
        "experience_years is a number in years. notice_period_days is a whole number of days. "
        "relevant_skills is a comma separated list. open_to_relocate is true, false or unknown. "
        "recommendation must be one of: high_potential, worth_pursuing, nurture, disqualify. "
        "summary is two sentences for the recruiter. "
        "Leave a field empty if the candidate did not answer it. Never guess."
    )

    return AgentBlueprint(
        name=f"HireFlow Outreach - {job_title}",
        agent_prompt=prompt,
        introduction=introduction,
        objective=(
            f"Qualify passive candidates for the {job_title} role at {company} and capture their "
            "interest, availability and compensation expectations."
        ),
        result_prompt=result_prompt,
        result_schema=OUTREACH_RESULT_SCHEMA,
        persona_name=persona_name,
        voice_persona=voice_persona,
        language=language,
        custom_variables=[
            "candidate_name",
            "current_title",
            "current_company",
            "location",
            "job_title",
        ],
    )


def build_interview_blueprint(
    *,
    job_title: str,
    company: str,
    interview_type: str,
    difficulty: str,
    duration_minutes: int,
    focus_areas: list[str],
    persona_name: str = "Aria",
    voice_persona: str = "NEHA",
    language: str = "ENGLISH",
) -> AgentBlueprint:
    focus_block = ", ".join(focus_areas) if focus_areas else "the core requirements of the role"

    prompt = (
        "You are {persona_name}, a senior technical interviewer conducting a "
        f"{difficulty}-level {interview_type} interview for a {job_title} position "
        f"at {company}.\n\n"
        f"The interview must run for approximately {duration_minutes} minutes and cover: "
        f"{focus_block}.\n\n"
        "How to conduct it:\n"
        "1. Open with one short warm-up question about the candidate's current work.\n"
        "2. Ask one question at a time and let the candidate finish before responding.\n"
        "3. Probe once when an answer is shallow - ask how or why, not a new topic.\n"
        "4. Stay neutral. Do not confirm whether an answer was right or wrong.\n"
        "5. Keep your own turns under fifteen seconds.\n"
        "6. Reserve the final minute for the candidate's questions, then close politely.\n\n"
        "Assess: depth of technical knowledge, clarity of communication, structured problem "
        "solving, and fit for the role."
    )

    introduction = (
        "Hi {callee_name}, this is {persona_name}. Thanks for making the time. I will be running "
        f"your {interview_type} interview for the {job_title} role at {company} today. "
        "It should take about "
        f"{duration_minutes} minutes. Shall we begin?"
    )

    result_prompt = (
        "Evaluate the interview transcript. Score technical_score, communication_score, "
        "problem_solving_score, role_fit_score and overall_score as integers from 0 to 100. "
        "strengths and concerns are comma separated short phrases. "
        "recommendation must be one of: strong_hire, shortlist, consider, reject. "
        "summary is a three sentence hiring recommendation grounded in what the candidate "
        "actually said. Do not invent evidence."
    )

    return AgentBlueprint(
        name=f"HireFlow Interviewer - {job_title} ({difficulty})",
        agent_prompt=prompt,
        introduction=introduction,
        objective=(
            f"Run a structured {interview_type} interview for {job_title} and return a scored, "
            "evidence-based evaluation."
        ),
        result_prompt=result_prompt,
        result_schema=INTERVIEW_RESULT_SCHEMA,
        persona_name=persona_name,
        voice_persona=voice_persona,
        language=language,
        custom_variables=["candidate_name", "job_title", "focus_areas"],
    )
