"""Seed the database with a realistic, demo-ready workspace.

Everything here flows through the real services - jobs are parsed by the JD
parser, candidates come from the people-search provider, and interviews and
outreach calls run through the actual voice pipeline (in demo mode) rather than
being hand-written rows. That means the seeded state is reachable by a user
clicking through the product, and it exercises the code paths a reviewer reads.

Run with:  python -m scripts.seed          (add --reset to wipe first)
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import delete, select

from app.core.logging import configure_logging, get_logger
from app.db.session import SessionLocal, engine
from app.models import Base
from app.models.attendance import AttendanceEvent, AuditLog, Employee, Location
from app.models.conversation import Conversation, ConversationTurn, VoiceCall
from app.models.enums import (
    ActivityType,
    AttendanceStatus,
    AttendanceVerification,
    CandidateStage,
    InsightSeverity,
    InterviewDifficulty,
    InterviewType,
    JobStatus,
)
from app.models.interview import Interview, InterviewAnswer, InterviewQuestion
from app.models.outreach import CandidateResponse, Outreach
from app.models.recruiting import Activity, AIInsight, Candidate, Job, JobMatch, User
from app.services import interview_service, job_service, outreach_service, sourcing_service
from app.services.activity import add_insight

logger = get_logger("seed")

RNG = random.Random(20260904)

DEMO_USER = {
    "email": "chetan@hireflow.ai",
    "full_name": "Chetan Sharma",
    "role": "Talent Acquisition Lead",
    "company": "HireFlow",
}

JOBS = [
    {
        "title": "Senior Full Stack Developer",
        "department": "Engineering",
        "location": "Gurgaon, Delhi NCR",
        "salary_min": 2200000,
        "salary_max": 3200000,
        "description": """We are hiring a Senior Full Stack Developer to join our product engineering team in Gurgaon, Delhi NCR.

You will own features end to end, from the database schema through to the React interface, working directly with product and design.

What you will do:
- Build and ship customer-facing features using React, TypeScript and Node.js
- Design and evolve REST APIs consumed by web and mobile clients
- Model data in MongoDB and keep queries fast as the dataset grows
- Review code, mentor two mid-level engineers and raise the engineering bar
- Take part in on-call and own the reliability of what you ship

What we are looking for:
- 4+ years of professional experience building web applications
- Strong React and Node.js fundamentals, with production TypeScript experience
- Comfortable designing REST APIs and working with MongoDB
- Able to reason about performance, not just correctness

Nice to have:
- Exposure to AWS and Docker
- Experience with system design at scale
- Prior startup experience""",
    },
    {
        "title": "Frontend Engineer",
        "department": "Engineering",
        "location": "Bengaluru",
        "salary_min": 1600000,
        "salary_max": 2400000,
        "description": """Frontend Engineer - Bengaluru (hybrid)

We are looking for a frontend engineer who cares about craft. You will work on the interface that every one of our customers uses daily.

Responsibilities:
- Build accessible, fast interfaces in React and TypeScript
- Own and extend our design system components
- Work with Next.js for our marketing and docs surfaces
- Partner with design on interaction detail, not just implementation
- Instrument and improve real-user performance metrics

Requirements:
- 3+ years building production frontends
- Deep React and TypeScript knowledge
- Strong CSS, comfortable with Tailwind CSS
- Understanding of accessibility and WCAG basics

Good to have:
- GraphQL experience
- Testing Library and Playwright""",
    },
    {
        "title": "Backend Engineer, Platform",
        "department": "Engineering",
        "location": "Remote",
        "salary_min": 2000000,
        "salary_max": 3000000,
        "description": """Backend Engineer, Platform - Remote (India)

Join the platform team building the services everything else at the company runs on.

You will:
- Design and build services in Python with FastAPI
- Own data modelling in PostgreSQL, including migrations and query performance
- Work on system design for multi-tenant workloads
- Improve our Docker and Kubernetes based deployment story
- Add observability so we find problems before customers do

We need:
- 5+ years of backend engineering experience
- Strong Python and PostgreSQL
- Practical system design experience with distributed systems
- Comfort with AWS

Preferred:
- Redis and Kafka experience
- Terraform""",
    },
    {
        "title": "Product Designer",
        "department": "Design",
        "location": "Bengaluru",
        "salary_min": 1800000,
        "salary_max": 2600000,
        "status": JobStatus.PAUSED,
        "description": """Product Designer - Bengaluru

Design the workflows that recruiting teams live in all day.

Responsibilities:
- Own end to end design for a product area, from research through to shipped UI
- Run user research sessions and turn findings into product decisions
- Extend and maintain our design system in Figma
- Prototype interactions before they get built

Requirements:
- 4+ years designing B2B or workflow-heavy products
- Strong Figma skills and a portfolio of shipped work
- Experience with user research and prototyping
- Working knowledge of accessibility

Nice to have:
- Experience designing for data-dense interfaces""",
    },
]

# Fabricated site names for the attendance design section.
CITY_POOL = [
    ("Gurgaon", "North"),
    ("Noida", "North"),
    ("Delhi", "North"),
    ("Jaipur", "North"),
    ("Lucknow", "North"),
    ("Chandigarh", "North"),
    ("Mumbai", "West"),
    ("Pune", "West"),
    ("Ahmedabad", "West"),
    ("Surat", "West"),
    ("Nagpur", "West"),
    ("Indore", "West"),
    ("Bengaluru", "South"),
    ("Chennai", "South"),
    ("Hyderabad", "South"),
    ("Kochi", "South"),
    ("Coimbatore", "South"),
    ("Mysuru", "South"),
    ("Kolkata", "East"),
    ("Bhubaneswar", "East"),
    ("Guwahati", "East"),
    ("Patna", "East"),
    ("Ranchi", "East"),
    ("Raipur", "East"),
]

FIRST_NAMES = [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Vihaan",
    "Arjun",
    "Reyansh",
    "Krishna",
    "Ishaan",
    "Ananya",
    "Diya",
    "Aadhya",
    "Saanvi",
    "Myra",
    "Anika",
    "Kiara",
    "Riya",
    "Rahul",
    "Priya",
    "Neha",
    "Rohit",
    "Sneha",
    "Amit",
    "Pooja",
    "Vikram",
]
LAST_NAMES = [
    "Sharma",
    "Verma",
    "Patel",
    "Reddy",
    "Nair",
    "Iyer",
    "Singh",
    "Gupta",
    "Das",
    "Bose",
    "Kulkarni",
    "Joshi",
    "Menon",
    "Rao",
    "Chauhan",
    "Mishra",
]
DESIGNATIONS = [
    "Field Executive",
    "Store Associate",
    "Shift Supervisor",
    "Warehouse Operator",
    "Delivery Associate",
    "Site Engineer",
    "Quality Inspector",
    "Team Lead",
]


def reset_database() -> None:
    """Drop every row while leaving the schema (and alembic version) intact."""
    logger.info("Clearing existing data...")
    with SessionLocal() as db:
        for model in (
            AttendanceEvent,
            AuditLog,
            Employee,
            Location,
            InterviewAnswer,
            InterviewQuestion,
            Interview,
            CandidateResponse,
            Outreach,
            ConversationTurn,
            Conversation,
            VoiceCall,
            JobMatch,
            AIInsight,
            Activity,
            Candidate,
            Job,
            User,
        ):
            db.execute(delete(model))
        db.commit()


def seed_recruiting() -> None:
    with SessionLocal() as db:
        user = User(**DEMO_USER)
        db.add(user)
        db.commit()

        logger.info("Creating jobs (descriptions run through the real JD parser)...")
        jobs: list[Job] = []
        for spec in JOBS:
            payload = dict(spec)
            status = payload.pop("status", JobStatus.OPEN)
            job = job_service.create_job(
                db,
                title=payload["title"],
                description=payload["description"],
                department=payload.get("department"),
                location=payload.get("location"),
                salary_min=payload.get("salary_min"),
                salary_max=payload.get("salary_max"),
                status=status,
            )
            job.owner_id = user.id
            db.commit()
            jobs.append(job)
            logger.info(
                "  %s -> %s required skills, %s+ years",
                job.title,
                len(job.required_skills),
                job.min_experience_years,
            )

        logger.info("Sourcing candidates through the people-search provider...")
        saved_by_job: dict[str, list[Candidate]] = {}
        for job in jobs:
            query = sourcing_service.build_query_from_job(job, limit=12)
            _, scored = sourcing_service.search_candidates(db, query=query, job=job)
            profiles = [
                {
                    "provider": item.profile.provider,
                    "provider_profile_id": item.profile.provider_profile_id,
                    "full_name": item.profile.full_name,
                    "headline": item.profile.headline,
                    "current_title": item.profile.current_title,
                    "current_company": item.profile.current_company,
                    "location": item.profile.location,
                    "country": item.profile.country,
                    "experience_years": item.profile.experience_years,
                    "skills": item.profile.skills,
                    "email": item.profile.email,
                    "phone": item.profile.phone,
                    "linkedin_url": item.profile.linkedin_url,
                    "summary": item.profile.summary,
                    "education": item.profile.education,
                    "experience": item.profile.experience,
                    "availability_hint": item.profile.availability_hint,
                }
                for item in scored[:8]
            ]
            saved = sourcing_service.save_profiles(db, profiles=profiles, job_id=job.id)
            saved_by_job[job.id] = saved
            logger.info("  %s -> %s candidates in the pool", job.title, len(saved))

        primary_job = jobs[0]
        pool = saved_by_job[primary_job.id]

        logger.info("Running AI outreach calls (demo provider)...")
        outreach_targets = pool[:5]
        batch = outreach_service.create_outreach_batch(
            db,
            job_id=primary_job.id,
            candidate_ids=[c.id for c in outreach_targets],
            campaign_name=f"{primary_job.title} - Week 36",
        )
        for record in batch:
            outreach_service.start_outreach(db, record.id)
            outreach_service.sync_outreach(db, record.id, force_complete=True)
        logger.info("  %s outreach conversations completed", len(batch))

        # A second job gets one outreach so the conversations list is not single-role.
        second_pool = saved_by_job[jobs[2].id]
        if second_pool:
            extra = outreach_service.create_outreach_batch(
                db,
                job_id=jobs[2].id,
                candidate_ids=[second_pool[0].id],
                campaign_name=f"{jobs[2].title} - Week 36",
            )
            outreach_service.start_outreach(db, extra[0].id)
            outreach_service.sync_outreach(db, extra[0].id, force_complete=True)

        # One outreach left mid-flight so the UI shows a live, in-progress call.
        if len(pool) > 5:
            queued = outreach_service.create_outreach_batch(
                db,
                job_id=primary_job.id,
                candidate_ids=[pool[5].id],
                campaign_name=f"{primary_job.title} - Week 36",
            )
            outreach_service.start_outreach(db, queued[0].id)

        logger.info("Running AI interviews (demo provider)...")
        interested = [
            candidate
            for candidate in pool
            if candidate.stage in (CandidateStage.INTERESTED, CandidateStage.CONTACTED)
        ]
        completed_targets = _varied_cohort(interested or pool, size=3)

        for index, candidate in enumerate(completed_targets):
            interview = interview_service.create_interview(
                db,
                job_id=primary_job.id,
                candidate_id=candidate.id,
                interview_type=InterviewType.TECHNICAL,
                difficulty=[InterviewDifficulty.INTERMEDIATE, InterviewDifficulty.ADVANCED][
                    index % 2
                ],
                duration_minutes=[30, 45, 30][index % 3],
                focus_areas=list(primary_job.required_skills or [])[:4],
            )
            interview_service.start_interview(db, interview.id)
            interview_service.sync_interview(db, interview.id, force_complete=True)
            db.refresh(interview)
            logger.info(
                "  %s -> %s/100 (%s)",
                candidate.full_name,
                interview.overall_score,
                interview.recommendation,
            )

        # Two interviews left scheduled so the dashboard has an upcoming section.
        remaining = [c for c in pool if c not in completed_targets][:2]
        for offset, candidate in enumerate(remaining, start=1):
            interview_service.create_interview(
                db,
                job_id=primary_job.id,
                candidate_id=candidate.id,
                interview_type=InterviewType.TECHNICAL,
                difficulty=InterviewDifficulty.INTERMEDIATE,
                duration_minutes=30,
                focus_areas=list(primary_job.required_skills or [])[:4],
                scheduled_at=datetime.now(UTC) + timedelta(days=offset, hours=2),
            )

        # A behavioural interview on the frontend role, still to be run.
        frontend_pool = saved_by_job[jobs[1].id]
        if frontend_pool:
            interview_service.create_interview(
                db,
                job_id=jobs[1].id,
                candidate_id=frontend_pool[0].id,
                interview_type=InterviewType.BEHAVIOURAL,
                difficulty=InterviewDifficulty.INTERMEDIATE,
                duration_minutes=25,
                focus_areas=["React", "TypeScript"],
                scheduled_at=datetime.now(UTC) + timedelta(days=3),
            )

        _spread_stages(db)
        _seed_insights(db, jobs)
        _backdate_activity(db)
        db.commit()


def _varied_cohort(candidates: list[Candidate], *, size: int) -> list[Candidate]:
    """Pick interviewees spanning strong / solid / developing performance.

    A demo where every scorecard says the same thing proves nothing, so the seed
    deliberately covers the range the evaluator can produce.
    """
    from app.services.demo_scripts import performance_tier

    buckets: dict[str, list[Candidate]] = {"strong": [], "solid": [], "developing": []}
    for candidate in candidates:
        buckets[performance_tier(candidate.id)].append(candidate)

    chosen: list[Candidate] = []
    for tier in ("strong", "solid", "developing"):
        if buckets[tier]:
            chosen.append(buckets[tier].pop(0))

    leftovers = [c for c in candidates if c not in chosen]
    chosen.extend(leftovers[: max(0, size - len(chosen))])
    return chosen[:size]


def _spread_stages(db) -> None:
    """Give the pipeline a realistic spread across every stage."""
    candidates = list(db.execute(select(Candidate)).scalars())
    untouched = [c for c in candidates if c.stage == CandidateStage.SOURCED]

    for candidate, stage in zip(
        untouched[-4:],
        [
            CandidateStage.HIRED,
            CandidateStage.REJECTED,
            CandidateStage.CONTACTED,
            CandidateStage.SOURCED,
        ],
        strict=False,
    ):
        candidate.stage = stage
        candidate.last_activity_at = datetime.now(UTC) - timedelta(days=RNG.randint(1, 6))
        db.add(
            Activity(
                type=ActivityType.CANDIDATE_STAGE_CHANGED,
                message=f"{candidate.full_name} moved to {stage.replace('_', ' ')}",
                actor="Chetan Sharma",
                candidate_id=candidate.id,
            )
        )
    db.commit()


def _seed_insights(db, jobs: list[Job]) -> None:
    add_insight(
        db,
        title="Frontend Engineer pipeline is thin",
        body=(
            "Only two candidates have been sourced for this role in the last week. "
            "Widen the location filter to Delhi NCR to roughly double the pool."
        ),
        severity=InsightSeverity.WARNING,
        action_label="Source candidates",
        action_href="/people-search",
        job_id=jobs[1].id,
    )
    add_insight(
        db,
        title="Notice periods are trending longer",
        body=(
            "Median notice across interested candidates is 45 days, up from 30 last month. "
            "Factor that into the start-date conversation."
        ),
        severity=InsightSeverity.INFO,
        action_label="Open analytics",
        action_href="/analytics",
    )
    db.commit()


def _backdate_activity(db) -> None:
    """Spread created_at across the last two weeks so charts are not a single spike."""
    now = datetime.now(UTC)
    for index, candidate in enumerate(db.execute(select(Candidate)).scalars()):
        candidate.created_at = now - timedelta(days=(index % 12) + 1, hours=RNG.randint(0, 20))
        if candidate.last_activity_at is None:
            candidate.last_activity_at = candidate.created_at + timedelta(hours=6)

    for index, activity in enumerate(db.execute(select(Activity)).scalars()):
        activity.created_at = now - timedelta(hours=index * 5 + RNG.randint(0, 4))

    for index, outreach in enumerate(db.execute(select(Outreach)).scalars()):
        outreach.created_at = now - timedelta(days=(index % 8) + 1, hours=2)

    for index, interview in enumerate(db.execute(select(Interview)).scalars()):
        interview.created_at = now - timedelta(days=(index % 6) + 1, hours=3)
    db.commit()


def seed_attendance(*, locations: int = 100, employees: int = 1000) -> None:
    """Seed the voice-attendance dataset at the scale the design targets."""
    logger.info("Seeding attendance: %s locations, %s employees...", locations, employees)
    with SessionLocal() as db:
        site_rows: list[Location] = []
        for index in range(locations):
            city, region = CITY_POOL[index % len(CITY_POOL)]
            site_rows.append(
                Location(
                    code=f"LOC-{index + 1:03d}",
                    name=f"{city} {['Hub', 'Depot', 'Centre', 'Branch'][index % 4]} {index // len(CITY_POOL) + 1}",
                    city=city,
                    region=region,
                    timezone="Asia/Kolkata",
                    # Fabricated DIDs in a reserved range - none of these are dialable.
                    inbound_number=f"+9180{46000000 + index:08d}",
                    headcount=0,
                    shift_start=["08:00", "09:00", "10:00"][index % 3],
                    grace_minutes=15,
                )
            )
        db.add_all(site_rows)
        db.flush()

        employee_rows: list[Employee] = []
        for index in range(employees):
            site = site_rows[index % locations]
            name = f"{RNG.choice(FIRST_NAMES)} {RNG.choice(LAST_NAMES)}"
            employee_rows.append(
                Employee(
                    employee_code=f"EMP-{index + 1:05d}",
                    full_name=name,
                    phone=f"+9198{RNG.randint(10000000, 99999999)}",
                    designation=RNG.choice(DESIGNATIONS),
                    location_id=site.id,
                    voiceprint_enrolled=RNG.random() > 0.06,
                    voiceprint_ref=f"vp_{index + 1:05d}" if RNG.random() > 0.06 else None,
                )
            )
            site.headcount += 1
        db.add_all(employee_rows)
        db.flush()

        today = date.today()
        events: list[AttendanceEvent] = []
        for day_offset in range(3):
            work_date = today - timedelta(days=day_offset)
            for employee in employee_rows:
                roll = RNG.random()
                if roll > 0.965:
                    continue  # absent: no call was received

                site = next(s for s in site_rows if s.id == employee.location_id)
                hour, minute = (int(part) for part in site.shift_start.split(":"))
                base = datetime.combine(work_date, time(hour, minute), tzinfo=UTC)

                if roll > 0.90:
                    status = AttendanceStatus.LATE
                    check_in = base + timedelta(minutes=RNG.randint(20, 95))
                elif roll > 0.875:
                    status = AttendanceStatus.PENDING_REVIEW
                    check_in = base + timedelta(minutes=RNG.randint(-10, 30))
                else:
                    status = AttendanceStatus.PRESENT
                    check_in = base + timedelta(minutes=RNG.randint(-14, 14))

                if not employee.voiceprint_enrolled:
                    method = AttendanceVerification.PIN
                    confidence = None
                elif status == AttendanceStatus.PENDING_REVIEW:
                    method = AttendanceVerification.PIN
                    confidence = round(RNG.uniform(0.42, 0.71), 2)
                else:
                    method = AttendanceVerification.VOICEPRINT
                    confidence = round(RNG.uniform(0.86, 0.99), 2)

                events.append(
                    AttendanceEvent(
                        employee_id=employee.id,
                        location_id=employee.location_id,
                        work_date=work_date,
                        check_in_at=check_in,
                        check_out_at=check_in + timedelta(hours=9) if day_offset > 0 else None,
                        status=status,
                        verification_method=method,
                        voice_match_confidence=confidence,
                        caller_number=employee.phone,
                        dialled_number=site.inbound_number,
                        flagged_reason=(
                            "Voice match below threshold - fell back to PIN"
                            if status == AttendanceStatus.PENDING_REVIEW
                            else None
                        ),
                    )
                )
        db.add_all(events)

        db.add_all(
            [
                AuditLog(
                    entity_type="attendance_event",
                    action="voice_check_in_recorded",
                    actor="ivr-worker-03",
                    detail=f"{len([e for e in events if e.work_date == today])} check-ins accepted for {today}",
                    meta={"work_date": today.isoformat()},
                ),
                AuditLog(
                    entity_type="employee",
                    action="voiceprint_enrolled",
                    actor="hr-admin@hireflow.ai",
                    detail="Enrolled 14 new joiners at Gurgaon Hub 1",
                ),
                AuditLog(
                    entity_type="attendance_event",
                    action="flagged_for_review",
                    actor="fraud-rules-engine",
                    detail="3 check-ins flagged: voice match below 0.75 confidence threshold",
                ),
                AuditLog(
                    entity_type="location",
                    action="inbound_number_provisioned",
                    actor="telephony-service",
                    detail="Provisioned DID for Kochi Centre 4",
                ),
                AuditLog(
                    entity_type="attendance_event",
                    action="supervisor_override",
                    actor="supervisor@hireflow.ai",
                    detail="Manual attendance recorded for EMP-00412 (handset out of service)",
                ),
            ]
        )
        db.commit()
        logger.info("  %s attendance events across %s days", len(events), 3)


def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description="Seed the HireFlow AI demo workspace.")
    parser.add_argument("--reset", action="store_true", help="Delete existing rows first.")
    parser.add_argument("--skip-attendance", action="store_true")
    args = parser.parse_args()

    # Safety net for a fresh checkout where migrations have not been run yet.
    Base.metadata.create_all(bind=engine)

    if args.reset:
        reset_database()

    with SessionLocal() as db:
        if db.execute(select(Job)).first() is not None:
            logger.warning("Data already present. Re-run with --reset to rebuild the workspace.")
            return 1

    seed_recruiting()
    if not args.skip_attendance:
        seed_attendance()

    with SessionLocal() as db:
        logger.info(
            "Done. %s jobs, %s candidates, %s interviews, %s outreach calls, %s conversations.",
            db.query(Job).count(),
            db.query(Candidate).count(),
            db.query(Interview).count(),
            db.query(Outreach).count(),
            db.query(Conversation).count(),
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
