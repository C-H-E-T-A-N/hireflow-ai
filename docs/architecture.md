# Architecture notes

Design decisions behind HireFlow AI, and why each one was made.

---

## 1. Every external dependency sits behind a protocol

Three integrations are genuinely external: voice calling, people search, and language models.
Each is defined as a Python `Protocol` with at least two implementations — one that talks to a real
vendor and one that runs locally.

| Contract | Live implementation | Local implementation |
| --- | --- | --- |
| `VoiceProviderProtocol` | `HunarVoiceProvider` | `DemoVoiceProvider` |
| `PeopleSearchProvider` | `PDLPeopleSearchProvider` | `MockPeopleSearchProvider` |
| `LLMProvider` | `AnthropicLLMProvider` | `HeuristicLLMProvider` |

**Why.** The assignment explicitly asked for a pluggable people-search abstraction, and the same
pressure applies to voice and LLM: an evaluator may not have credentials, and a demo cannot depend
on a third party being up. Because the boundary is a protocol rather than an `if` statement, no
service, router or React component knows which implementation is active.

**The rule that keeps it honest.** The active provider is returned to the client on every record
(`provider: "demo"`) and summarised at `/system/status`. Local implementations mark their output
(`is_live: false`, `"simulated": true`) and the UI renders that state explicitly. A simulation is
never dressed up as a real API response.

---

## 2. The structured `result` is the integration contract

Hunar agents are configured with a `result_prompt` and a `result_schema`. That schema is the
contract between the voice platform and our database:

- `OUTREACH_RESULT_SCHEMA` maps one-to-one onto the columns of `candidate_responses`.
- `INTERVIEW_RESULT_SCHEMA` maps onto the score columns of `interviews`.

The demo provider fills the *same* schema. That is what makes demo and live runs produce identical
downstream records, and it is why swapping `DEMO_MODE` changes nothing about how results are read,
displayed or scored.

It also matches the platform's actual shape. Hunar returns a schema-driven `result` and a
recording for a completed call; it does not expose a transcript endpoint. Building around the
structured result rather than around a transcript means the integration works with what the API
actually provides.

---

## 3. Two paths in, one state machine

A call's state can advance two ways: the platform pushes a webhook, or we poll it.

Both funnel into the same place. `POST /webhooks/hunar` verifies the signature, writes what the
event tells us onto the `voice_calls` row, and then calls `interview_service.sync_interview` or
`outreach_service.sync_outreach` — the same functions the polling endpoints call. There is exactly
one implementation of "what does this call state mean", so the two paths cannot drift.

---

## 4. Scoring is explainable by construction

Two scores matter in this product, and neither is a black box.

**Match score** (`services/matching.py`) is a weighted sum — 60% skills, 25% experience, 15%
location — that returns the matched skills, the missing skills and a written rationale alongside
the number. Near-misses lose points rather than being filtered out (a candidate half a year short
of the bar is still worth a recruiter's attention), and over-qualification is a mild penalty
rather than a disqualifier.

**Interview score** comes from a rubric. Each generated question declares `expected_signals` — the
concepts a strong answer should touch. An answer is scored on the proportion of those signals it
covered, with answer length contributing at most 15 points and never rescuing an answer that
missed the rubric entirely. The scorecard shows, per question, which signals were hit and which
were not.

**Why it matters.** Hiring decisions get challenged. A recruiter who cannot explain why a
candidate scored 62 cannot defend the decision, and a candidate has a reasonable claim to know
what the number meant.

---

## 5. Synchronous I/O, deliberately

The backend uses synchronous SQLAlchemy and a synchronous `httpx.Client`, with FastAPI running
endpoints in its threadpool.

**Why.** An earlier draft used async clients with a sync ORM, which meant blocking the event loop
inside `async def` handlers — the worst of both. Going fully synchronous removed an entire class
of concurrency bug at a workload (a recruiting workspace, not a high-throughput service) where
async buys nothing. The one genuinely async endpoint is the webhook, which awaits the raw request
body and then hands the database work to `run_in_threadpool`.

---

## 6. The database runs on Postgres and SQLite from one migration set

Primary keys are 36-character strings rather than a native `UUID` type, enums are stored as
strings rather than PostgreSQL enums, and structured columns use SQLAlchemy's generic `JSON`.
Alembic runs in batch mode on SQLite.

**Why.** The evaluator should be able to clone and run with no infrastructure — `DATABASE_URL`
defaults to a local SQLite file. But production should be PostgreSQL, and maintaining two schemas
is how they drift. String keys and generic JSON cost nothing here and keep a single migration path.
Storing enums as strings also means adding a pipeline stage never requires an enum migration.

---

## 7. The browser never learns the backend URL

The frontend calls `/api/proxy/*` — a Next.js route handler that forwards to
`BACKEND_API_URL`, a server-only variable. There is no `NEXT_PUBLIC_*` variable in the project.

**Why.** It keeps credentials and infrastructure detail out of the client bundle, removes CORS
from the normal deployment shape, and gives one place to add auth headers, rate limiting or
request logging later. When the backend is unreachable the proxy returns the *same* error envelope
the API uses, so every screen's error state renders it without special-casing.

---

## 8. Data fetching is a hook, not a library

`useApi` is ~90 lines: fetch, error, optional polling (paused when the tab is hidden), and manual
refresh. `isLoading` is derived (`data === undefined && !error`) rather than stored, so there is
one source of truth and nothing to synchronise when the path changes — a filter change
revalidates in the background instead of flashing a skeleton.

**Why.** The app needs a loading state, an error state, and polling during live calls. A data
library would be more code to configure than to write, and this keeps the dependency surface
small.

---

## 9. Demo timelines are compressed and deterministic

A real screening call runs three to four minutes. The demo provider replays its script on a
compressed timeline so a full conversation completes in 40–60 seconds, and every screen offers a
**Skip to result** action for evaluators who do not want to wait at all.

Scripts are seeded from the candidate id, so a given candidate always performs the same way. The
seed script uses that determinism deliberately: it picks interviewees spanning strong, solid and
developing performance, because a demo where every scorecard says the same thing proves nothing.

---

## 10. The design system is tokens first

Colour, elevation, radius and motion are CSS custom properties defined once and mapped into
Tailwind v4 via `@theme inline`. Light and dark are the same token names with different values, so
no component contains a `dark:` variant for colour.

Charts are hand-built SVG rather than a charting library — the shapes needed here (sparkline, area
timeline, funnel, bars, donut, score rings) are simple, and drawing them directly keeps them on the
design tokens, keeps the bundle small, and avoids fighting a third party for control of the
visuals.

AI cues are rationed: a gradient surface, a waveform and a sparkle badge mark *model output*
specifically. They are signage, not decoration — which is what keeps the product reading as
enterprise software rather than a demo toy.
