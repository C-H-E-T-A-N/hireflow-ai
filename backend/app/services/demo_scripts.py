"""Builders for demo conversation scripts.

DEMO DATA ONLY. These functions synthesise a plausible conversation so the
end-to-end product can be shown without placing real calls. They are used
exclusively by the demo voice provider and every record they produce is tagged
`provider="demo"`.

The script is deterministic per candidate (seeded from the candidate id), so a
given candidate always performs consistently across reruns - which makes the
demo repeatable and the scores explainable.
"""

from __future__ import annotations

import hashlib
from typing import Any

from app.integrations.hunar.base import ScriptedTurn
from app.models.enums import AvailabilityStatus
from app.services.question_bank import GeneratedQuestion

# Seconds between consecutive utterances on the compressed demo timeline.
AGENT_TURN_GAP = 2.2
CANDIDATE_TURN_GAP = 3.4


def _seed(value: str) -> int:
    return int(hashlib.sha256(value.encode()).hexdigest()[:8], 16)


def _tier(candidate_id: str) -> tuple[str, float]:
    """Map a candidate onto a consistent performance tier."""
    bucket = _seed(candidate_id) % 100
    if bucket >= 72:
        return "strong", 0.88
    if bucket >= 34:
        return "solid", 0.72
    return "developing", 0.40


def performance_tier(candidate_id: str) -> str:
    """Public accessor used by the seed script to build a varied demo cohort."""
    return _tier(candidate_id)[0]


def _signal_subset(signals: list[str], ratio: float, salt: str) -> list[str]:
    if not signals:
        return []
    count = max(1, round(len(signals) * ratio))
    ordered = sorted(signals, key=lambda item: _seed(salt + item))
    return ordered[:count]


# --- Interview ----------------------------------------------------------------


def build_interview_script(
    *,
    candidate_id: str,
    candidate_name: str,
    candidate_company: str | None,
    job_title: str,
    company: str,
    persona_name: str,
    questions: list[GeneratedQuestion],
) -> tuple[list[ScriptedTurn], dict[str, Any], list[dict[str, Any]]]:
    """Return (timeline, provider result payload, per-question answer records)."""
    tier, ratio = _tier(candidate_id)
    employer = candidate_company or "my current company"

    turns: list[ScriptedTurn] = []
    answers: list[dict[str, Any]] = []
    clock = 0.0

    turns.append(
        ScriptedTurn(
            "agent",
            f"Hi {candidate_name.split()[0]}, this is {persona_name} from {company}. Thanks for "
            f"making the time. I will be running your interview for the {job_title} role today. "
            "Shall we get started?",
            clock,
            {"phase": "introduction"},
        )
    )
    clock += CANDIDATE_TURN_GAP
    turns.append(
        ScriptedTurn(
            "candidate",
            "Hi, yes absolutely. Thanks for having me, I am ready when you are.",
            clock,
        )
    )

    for index, question in enumerate(questions):
        clock += AGENT_TURN_GAP
        turns.append(
            ScriptedTurn(
                "agent",
                question.prompt,
                clock,
                {"question_index": index, "focus_area": question.focus_area},
            )
        )

        signals = _signal_subset(question.expected_signals, ratio, candidate_id + question.prompt)
        answer_text = _compose_answer(tier, signals, employer, question)

        clock += CANDIDATE_TURN_GAP
        turns.append(ScriptedTurn("candidate", answer_text, clock, {"question_index": index}))
        answers.append(
            {
                "question_index": index,
                "transcript": answer_text,
                "expected_signals": question.expected_signals,
                "competency": question.competency,
                "focus_area": question.focus_area,
            }
        )

    clock += AGENT_TURN_GAP
    turns.append(
        ScriptedTurn(
            "agent",
            "That is everything from my side. The recruiting team will follow up with next "
            "steps within two working days. Thanks for your time today.",
            clock,
            {"phase": "conclusion"},
        )
    )
    clock += 2.0
    turns.append(ScriptedTurn("candidate", "Thank you, I appreciate it. Have a good day.", clock))

    # The provider "result" mirrors INTERVIEW_RESULT_SCHEMA; the real scoring is
    # done by the evaluation service from the answers above.
    result = {"answers": answers, "tier": tier, "simulated": True}
    return turns, result, answers


ANSWER_OPENERS = {
    "strong": [
        "Yes, I have dealt with this directly.",
        "Good question, this came up on my last project.",
        "I have hit exactly this before.",
    ],
    "solid": [
        "Yeah, I have some experience with that.",
        "I think I can speak to this reasonably well.",
        "Sure, I have run into a version of this.",
    ],
    "developing": [
        "I have not done a lot of this, but I can talk about what I know.",
        "I have touched this a little.",
        "Honestly this is an area I am still building on.",
    ],
}


def _compose_answer(
    tier: str, signals: list[str], employer: str, question: GeneratedQuestion
) -> str:
    opener = ANSWER_OPENERS[tier][_seed(question.prompt) % 3]

    if not signals:
        return (
            f"{opener} At {employer} we handled it case by case, so I would want to look at "
            "the specifics before committing to an approach."
        )

    lead = signals[0]
    rest = signals[1:]

    body = f"The first thing I would look at is {lead}."
    if rest:
        listed = ", ".join(rest[:-1]) + (" and " + rest[-1] if len(rest) > 1 else rest[-1])
        body += f" From there I would work through {listed}."

    if tier == "strong":
        closing = (
            f" At {employer} we did exactly this and it took the problem from a recurring "
            "incident down to nothing over about a month. I would measure it before and after "
            "so the improvement is not just a feeling."
        )
    elif tier == "solid":
        closing = (
            f" We did something similar at {employer}. It worked, though I would probably "
            "instrument it better a second time round."
        )
    else:
        closing = " I would probably pair with someone more senior on the details."

    return f"{opener} {body}{closing}"


# --- Outreach -----------------------------------------------------------------


def build_outreach_script(
    *,
    candidate_id: str,
    candidate_name: str,
    current_title: str | None,
    current_company: str | None,
    location: str | None,
    experience_years: float | None,
    skills: list[str],
    job_title: str,
    company: str,
    persona_name: str,
    availability_hint: str | None = None,
) -> tuple[list[ScriptedTurn], dict[str, Any]]:
    first_name = candidate_name.split()[0]
    role = current_title or "my current role"
    employer = current_company or "my current company"
    city = (location or "Bengaluru").split(",")[0].strip()
    years = experience_years or 3.0
    top_skills = skills[:4] or ["JavaScript"]

    interest, notice_days, expected_ctc, reason = _outreach_outcome(
        candidate_id, availability_hint, years
    )

    turns: list[ScriptedTurn] = []
    clock = 0.0

    def add(speaker: str, content: str, gap: float, meta: dict | None = None) -> None:
        nonlocal clock
        clock += gap
        turns.append(ScriptedTurn(speaker, content, round(clock, 1), meta or {}))

    add(
        "agent",
        f"Hi, am I speaking with {first_name}? This is {persona_name} calling from {company} "
        f"about a {job_title} role. Do you have two minutes?",
        0.0,
        {"phase": "introduction"},
    )
    add("candidate", "Hi, yes this is him. Sure, I have a couple of minutes.", CANDIDATE_TURN_GAP)

    add(
        "agent",
        f"Great. We are hiring a {job_title} and your background stood out. Before I go "
        "further, are you open to hearing about a new opportunity right now?",
        AGENT_TURN_GAP,
        {"extracts": "interest_level"},
    )

    if interest == "interested":
        add(
            "candidate",
            "Yes, I am open to it. I am not actively looking, but I would listen to something "
            "that is a genuine step up.",
            CANDIDATE_TURN_GAP,
        )
    elif interest == "maybe_later":
        add(
            "candidate",
            "I am fairly settled at the moment, honestly. Maybe in a few months, but not "
            "right now.",
            CANDIDATE_TURN_GAP,
        )
    else:
        add(
            "candidate",
            "I appreciate the call, but I just started something new here and I am not "
            "looking to move.",
            CANDIDATE_TURN_GAP,
        )

    add(
        "agent",
        "Understood, thank you for being straight with me. Can I quickly confirm your current "
        "role and how long you have been in the industry?",
        AGENT_TURN_GAP,
        {"extracts": "current_role, experience_years"},
    )
    add(
        "candidate",
        f"Sure. I am a {role} at {employer}, and I have about {years:g} years of experience "
        f"overall, mostly with {', '.join(top_skills[:3])}.",
        CANDIDATE_TURN_GAP,
    )

    add(
        "agent",
        "And which city are you based in currently?",
        AGENT_TURN_GAP,
        {"extracts": "current_location"},
    )
    add("candidate", f"I am in {city} right now.", CANDIDATE_TURN_GAP)

    if interest == "not_interested":
        add(
            "agent",
            "That is completely fair. Would it be alright if I checked back in six months?",
            AGENT_TURN_GAP,
        )
        add("candidate", "Yes, that is fine. Feel free to reach out then.", CANDIDATE_TURN_GAP)
        add(
            "agent",
            "Perfect, I will make a note. Thanks for your time and have a good day.",
            AGENT_TURN_GAP,
            {"phase": "conclusion"},
        )
    else:
        add(
            "agent",
            "Helpful, thank you. If something did work out, what notice period would you "
            "need to serve?",
            AGENT_TURN_GAP,
            {"extracts": "notice_period_days"},
        )
        add(
            "candidate",
            f"My notice is {notice_days} days. I could potentially negotiate slightly on that.",
            CANDIDATE_TURN_GAP,
        )

        add(
            "agent",
            "Understood. And do you have a compensation range in mind, so I only bring you "
            "roles that clear it?",
            AGENT_TURN_GAP,
            {"extracts": "expected_compensation"},
        )
        add(
            "candidate",
            f"I am looking at around {expected_ctc}, depending on the overall package.",
            CANDIDATE_TURN_GAP,
        )

        add(
            "agent",
            "That is workable. Last one: what would make a move worth it for you?",
            AGENT_TURN_GAP,
            {"extracts": "reason_for_interest"},
        )
        add("candidate", reason, CANDIDATE_TURN_GAP)

        add(
            "agent",
            "That lines up well with this role. I will send the details across and the "
            "recruiter will follow up to book a conversation. Thanks for your time today.",
            AGENT_TURN_GAP,
            {"phase": "conclusion"},
        )
        add("candidate", "Sounds good, thank you for calling.", CANDIDATE_TURN_GAP)

    recommendation = {
        "interested": "high_potential",
        "maybe_later": "nurture",
        "not_interested": "disqualify",
    }[interest]

    # Shaped exactly like OUTREACH_RESULT_SCHEMA so the demo and live paths
    # write identical CandidateResponse rows.
    result: dict[str, Any] = {
        "interest_level": interest,
        "current_role": current_title,
        "current_company": current_company,
        "experience_years": years,
        "current_location": city,
        "notice_period_days": notice_days if interest != "not_interested" else None,
        "expected_compensation": expected_ctc if interest != "not_interested" else None,
        "relevant_skills": ", ".join(top_skills),
        "availability": _availability_text(notice_days) if interest != "not_interested" else None,
        "reason_for_interest": reason
        if interest != "not_interested"
        else "Recently started a new role.",
        "open_to_relocate": interest == "interested",
        "recommendation": recommendation,
        "simulated": True,
    }
    return turns, result


def _outreach_outcome(
    candidate_id: str, availability_hint: str | None, years: float
) -> tuple[str, int, str, str]:
    bucket = _seed(candidate_id) % 100

    if availability_hint == AvailabilityStatus.NOT_LOOKING:
        interest = "not_interested"
    elif bucket >= 62:
        interest = "interested"
    elif bucket >= 30:
        interest = "interested" if bucket % 2 == 0 else "maybe_later"
    else:
        interest = "maybe_later"

    notice_days = {
        AvailabilityStatus.IMMEDIATE: 15,
        AvailabilityStatus.ONE_MONTH: 30,
        AvailabilityStatus.TWO_MONTHS: 60,
        AvailabilityStatus.THREE_MONTHS_PLUS: 90,
    }.get(availability_hint or "", 30 if bucket % 2 else 60)

    base_lpa = max(8, round(years * 4.2))
    expected_ctc = f"{base_lpa} to {base_lpa + 5} LPA"

    reasons = [
        "Mostly ownership. I want to be closer to the product decisions rather than "
        "just picking up tickets.",
        "Scale, honestly. I want to work on something where the hard problems are real "
        "and not hypothetical.",
        "I am looking for stronger engineering mentorship and a team that reviews seriously.",
    ]
    return interest, notice_days, expected_ctc, reasons[bucket % 3]


def _availability_text(notice_days: int) -> str:
    if notice_days <= 15:
        return "Available within two weeks"
    if notice_days <= 30:
        return "Available in about a month"
    if notice_days <= 60:
        return "Available in about two months"
    return "Available in three months or more"
