"""Interview question generation.

Questions are assembled from a curated bank keyed by focus area and difficulty.
Each question carries `expected_signals`: the concepts a strong answer should
touch. Those signals are what the evaluator scores against, which keeps the
scorecard grounded in a rubric instead of vibes.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.enums import InterviewDifficulty, InterviewType


@dataclass(slots=True)
class GeneratedQuestion:
    prompt: str
    focus_area: str
    competency: str
    expected_signals: list[str]
    weight: float = 1.0


# focus area -> difficulty -> questions
BANK: dict[str, dict[str, list[GeneratedQuestion]]] = {
    "React": {
        "entry": [
            GeneratedQuestion(
                "Walk me through what happens when React state changes. What does React do next?",
                "React",
                "Technical Depth",
                ["render", "state", "virtual dom", "component"],
            )
        ],
        "intermediate": [
            GeneratedQuestion(
                "A list of 5,000 rows re-renders on every keystroke in a search box. "
                "How would you diagnose and fix that?",
                "React",
                "Problem Solving",
                ["memo", "re-render", "profiler", "virtualisation", "debounce"],
            ),
            GeneratedQuestion(
                "When do you reach for context versus a state library, and what breaks "
                "when you get that call wrong?",
                "React",
                "Technical Depth",
                ["context", "re-render", "state management", "prop drilling"],
            ),
        ],
        "advanced": [
            GeneratedQuestion(
                "How would you design a component library that three product teams "
                "consume without them forking it?",
                "React",
                "Technical Depth",
                ["design system", "composition", "versioning", "api surface", "accessibility"],
            )
        ],
    },
    "Node.js": {
        "intermediate": [
            GeneratedQuestion(
                "An endpoint's p99 latency jumps from 90ms to 4 seconds under load "
                "while CPU stays low. Where do you look?",
                "Node.js",
                "Problem Solving",
                ["event loop", "blocking", "connection pool", "async", "profiling"],
            ),
            GeneratedQuestion(
                "How do you handle an unhandled promise rejection in a production "
                "Node service, and what should happen to the process?",
                "Node.js",
                "Technical Depth",
                ["error handling", "process", "graceful shutdown", "logging"],
            ),
        ],
        "advanced": [
            GeneratedQuestion(
                "Describe how you would make a Node service safely handle a "
                "third-party API that intermittently hangs.",
                "Node.js",
                "Technical Depth",
                ["timeout", "circuit breaker", "retry", "backoff", "idempotent"],
            )
        ],
    },
    "TypeScript": {
        "intermediate": [
            GeneratedQuestion(
                "Where has TypeScript actually caught bugs for you, and where has it "
                "just added ceremony?",
                "TypeScript",
                "Technical Depth",
                ["type safety", "generics", "any", "refactor", "inference"],
            )
        ],
        "advanced": [
            GeneratedQuestion(
                "How would you type an API client so that the response type is "
                "derived from the endpoint being called?",
                "TypeScript",
                "Technical Depth",
                ["generics", "inference", "union", "mapped type", "discriminated"],
            )
        ],
    },
    "System Design": {
        "intermediate": [
            GeneratedQuestion(
                "Design the backend for a notification service that must deliver "
                "10,000 messages a minute across email, SMS and push.",
                "System Design",
                "Problem Solving",
                ["queue", "worker", "retry", "idempotent", "rate limit", "fan out"],
            )
        ],
        "advanced": [
            GeneratedQuestion(
                "You need to move a 400GB table to a new schema with no downtime. "
                "Walk me through the plan and the rollback.",
                "System Design",
                "Problem Solving",
                ["dual write", "backfill", "migration", "rollback", "consistency", "shadow"],
            ),
            GeneratedQuestion(
                "How do you decide where to put a cache, and how do you keep it from "
                "serving stale data?",
                "System Design",
                "Technical Depth",
                ["ttl", "invalidation", "cache", "consistency", "read through"],
            ),
        ],
    },
    "PostgreSQL": {
        "intermediate": [
            GeneratedQuestion(
                "A query that used an index yesterday is doing a sequential scan "
                "today. How do you investigate?",
                "PostgreSQL",
                "Problem Solving",
                ["explain", "index", "statistics", "analyze", "query plan"],
            )
        ],
    },
    "MongoDB": {
        "intermediate": [
            GeneratedQuestion(
                "How do you decide between embedding and referencing documents, and "
                "what goes wrong at scale if you pick wrong?",
                "MongoDB",
                "Technical Depth",
                ["embed", "reference", "document size", "index", "aggregation"],
            )
        ],
    },
    "REST APIs": {
        "intermediate": [
            GeneratedQuestion(
                "How do you version a public API that already has customers on it?",
                "REST APIs",
                "Technical Depth",
                ["versioning", "backward compatible", "deprecation", "contract"],
            )
        ],
    },
    "AWS": {
        "intermediate": [
            GeneratedQuestion(
                "Talk me through how you would deploy and roll back a containerised "
                "service on AWS without dropping traffic.",
                "AWS",
                "Technical Depth",
                ["load balancer", "health check", "blue green", "rollback", "ecs"],
            )
        ],
    },
    "Python": {
        "intermediate": [
            GeneratedQuestion(
                "When would you reach for async Python, and when is it the wrong tool?",
                "Python",
                "Technical Depth",
                ["async", "io bound", "cpu bound", "gil", "concurrency"],
            )
        ],
    },
}

# Always asked, regardless of focus area.
WARMUP = GeneratedQuestion(
    "To start, tell me about what you are building right now and what part of it "
    "you own end to end.",
    "Introduction",
    "Communication",
    ["own", "built", "team", "responsible"],
    weight=0.7,
)

BEHAVIOURAL = [
    GeneratedQuestion(
        "Tell me about a technical decision you made that turned out to be wrong. "
        "What did you do about it?",
        "Behavioural",
        "Communication",
        ["decision", "mistake", "learned", "changed", "team"],
    ),
    GeneratedQuestion(
        "Describe a time you disagreed with a senior colleague on an approach. How did it resolve?",
        "Behavioural",
        "Communication",
        ["disagree", "data", "compromise", "outcome"],
    ),
]

ROLE_FIT = GeneratedQuestion(
    "What are you looking for in your next role, and what would make you leave your current one?",
    "Motivation",
    "Role Fit",
    ["growth", "ownership", "learning", "team", "impact"],
    weight=0.8,
)


def generate_questions(
    *,
    focus_areas: list[str],
    difficulty: str,
    interview_type: str,
    duration_minutes: int,
) -> list[GeneratedQuestion]:
    """Pick a question set that fits the configured duration.

    Roughly one question per five minutes of call time, always bookended by the
    warm-up and the motivation question.
    """
    target = max(3, min(round(duration_minutes / 5), 10))
    selected: list[GeneratedQuestion] = [WARMUP]

    difficulty_order = _difficulty_ladder(difficulty)

    if interview_type != InterviewType.BEHAVIOURAL:
        for area in focus_areas:
            entries = BANK.get(area)
            if not entries:
                continue
            for level in difficulty_order:
                for question in entries.get(level, []):
                    if question not in selected:
                        selected.append(question)
                        break
                if len(selected) >= target:
                    break
            if len(selected) >= target:
                break

    if interview_type in (InterviewType.BEHAVIOURAL, InterviewType.CULTURE_FIT):
        selected.extend(BEHAVIOURAL)
    elif len(selected) < target:
        selected.append(BEHAVIOURAL[0])

    selected.append(ROLE_FIT)

    if len(selected) < 3:
        selected.append(_generic_question(focus_areas))

    return selected[: target + 1]


def _difficulty_ladder(difficulty: str) -> list[str]:
    """Prefer the requested level, then step outward to keep coverage."""
    ladder = {
        InterviewDifficulty.ENTRY: ["entry", "intermediate", "advanced"],
        InterviewDifficulty.INTERMEDIATE: ["intermediate", "entry", "advanced"],
        InterviewDifficulty.ADVANCED: ["advanced", "intermediate", "entry"],
        InterviewDifficulty.EXPERT: ["advanced", "intermediate", "entry"],
    }
    return ladder.get(difficulty, ["intermediate", "advanced", "entry"])


def _generic_question(focus_areas: list[str]) -> GeneratedQuestion:
    area = focus_areas[0] if focus_areas else "your core stack"
    return GeneratedQuestion(
        f"Take me through the hardest problem you have solved with {area} and how "
        "you approached it.",
        area,
        "Problem Solving",
        ["approach", "trade off", "constraint", "outcome"],
    )


AVAILABLE_FOCUS_AREAS: list[str] = sorted(BANK.keys())
