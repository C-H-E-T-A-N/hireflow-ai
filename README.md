# HireFlow AI

**AI-powered recruiting from sourcing to interview.**

HireFlow AI is a full-stack recruiting platform built around voice AI. It parses a job
description into structured requirements, sources matching candidates through a pluggable
people-search provider, calls the promising ones with an AI voice recruiter, extracts their
answers as structured data, and then runs scored AI interviews — all against one candidate record.

Built as a response to the Hunar.ai assignment. It covers all three parts: the AI hiring
assistant, people search with AI reachout, and a voice-first attendance system design.

---

## Table of contents

- [What it does](#what-it-does)
- [Assignment coverage](#assignment-coverage)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Hunar.ai integration](#hunarai-integration)
- [People search integration](#people-search-integration)
- [LLM integration](#llm-integration)
- [Demo mode](#demo-mode)
- [API reference](#api-reference)
- [Testing](#testing)
- [Security](#security)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## What it does

| Capability | What happens |
| --- | --- |
| **JD parsing** | Paste a job description; the parser extracts required skills, nice-to-haves, experience range, seniority and locations. |
| **Candidate sourcing** | Search a people-search provider using those requirements. Every profile gets an explainable match score broken into skills, experience and location. |
| **AI voice outreach** | An AI recruiter calls selected candidates and returns structured answers: interest, current role, experience, location, notice period, expected compensation, skills, availability and reason for interest. |
| **AI voice interviews** | Configure focus areas, difficulty and duration. HireFlow generates a rubric-backed question set, runs the interview, and scores each answer on the signals it actually covered. |
| **Conversation intelligence** | Every call produces a transcript timeline, an extracted answer set, an AI summary and a recommendation, attached to the candidate. |
| **Recruiter dashboard** | Pipeline by stage, recent candidates, upcoming interviews, activity feed and derived AI insights. |
| **Analytics** | Funnel conversion, connect rate, interest split, interview score distribution and daily activity. |
| **Attendance design** | An interactive system-design section for tracking 1,000 employees across 100 locations by phone, backed by a real schema and seeded data. |

---

## Assignment coverage

### Part 1 — AI Hiring Assistant

| Requirement | Where it lives |
| --- | --- |
| Create/select a job | `POST /api/v1/jobs`, `GET /api/v1/jobs` → **Jobs** page, with a create dialog |
| Add a job description | Job description field; parsed automatically on create (`job_service.create_job`) |
| Create an AI interview configuration | `POST /api/v1/interviews` → **AI Interviews → New interview**: type, focus areas, difficulty, duration, agent persona |
| Start an AI voice interview | `POST /api/v1/interviews/{id}/start` → places a Hunar call (`HunarVoiceProvider.place_call`) or a simulated one in demo mode |
| Show interview status | `GET /api/v1/interviews/{id}/live` — polled by the live interview room: agent state, elapsed time, current question, progress |
| Store the conversation/transcript | `conversations` + `conversation_turns` tables, written by `voice_service.sync_turns` |
| Extract candidate answers | `interview_service._collect_answers` maps each candidate utterance to the question that prompted it and stores it in `interview_answers` |
| Evaluate the candidate | `LLMProvider.evaluate_interview` scores answers against each question's `expected_signals` rubric |
| Display score + AI recommendation | Interview scorecard: overall score, four competency bars, strengths, concerns, per-question rubric coverage, and a `strong_hire` / `shortlist` / `consider` / `reject` recommendation |

**The interview flow end to end:** configure → questions generated from the focus areas →
`start` places the call → the live room streams the transcript as the conversation progresses →
on completion the answers are collected and scored → the scorecard renders with evidence for
every number.

### Part 2 — People Search & AI Reachout

| Requirement | Where it lives |
| --- | --- |
| Enter/paste a job description | **People Search** page, or reuse a saved job's parsed requirements |
| Parse/extract requirements | `POST /api/v1/jobs/parse-description` → the "Detected requirements" panel |
| Search for candidates | `POST /api/v1/search/candidates` through the `PeopleSearchProvider` abstraction |
| Display candidate profiles | Result cards: avatar, title, company, location, experience, skills, match score, availability, actions |
| Filter/sort candidates | Minimum match score, location, and sort by match / experience / name |
| Select candidates for outreach | Multi-select on the results grid; selection bar offers *Save to pool* and *Start AI outreach* |
| Initiate AI voice outreach | `POST /api/v1/outreach` (batch) → `POST /api/v1/outreach/{id}/start` |
| Capture the conversation | Same `conversations` / `conversation_turns` tables as interviews |
| Extract structured responses | `candidate_responses` table, populated from the agent's `result_schema` |
| Recruiter dashboard | **AI Outreach** page: status, interest, notice period, expected compensation and recommendation per candidate |

**Extracted fields:** interest level, current role, current company, years of experience, current
location, notice period, expected compensation, relevant skills, availability, reason for
interest, open to relocate, AI summary, AI recommendation.

### Part 3 — Attendance Without Smartphones

The **Attendance** page presents the full design: problem framing, the employee's actual call
experience, an interactive architecture diagram, and detail panels for identity verification,
location verification, attendance processing, fraud prevention, failure handling, scalability,
privacy and the audit trail.

**Proposed architecture**

```
Employee (any handset)
        ↓
Telephony / IVR  — one inbound number (DID) per location
        ↓
Voice AI agent   — three-question script, schema-driven result
        ↓
Identity verification  — caller ID → voiceprint → PIN fallback
        ↓
Location verification  — dialled DID + carrier region + rotating site code
        ↓
Attendance service     — shift rules, idempotent write
        ↓
PostgreSQL             — attendance_events, employees, locations, audit_logs
        ↓
HR dashboard           — roll-up, exceptions queue, payroll export
```

The core insight is that **the number dialled is the location assertion** — infrastructure proves
where the employee is, rather than the employee claiming it. Identity is layered cheapest-first:
caller ID lowers friction, a voiceprint confirms the speaker, and a PIN covers everyone else.
Anything ambiguous becomes `pending_review` rather than a wrongly recorded absence.

This part is a **system design deliverable, not a shipped calling system**. What *is* real in this
repository: the relational schema (`locations`, `employees`, `attendance_events`, `audit_logs`),
the read APIs behind the dashboard, and a seeded dataset of 100 locations and 1,000 employees with
~2,900 attendance events. The voice layer would reuse the same Hunar agent + `result_schema`
mechanism that already powers recruiting calls here.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  Next.js (App Router) · React · TypeScript · Tailwind        │
└───────────────────────────┬──────────────────────────────────┘
                            │  /api/proxy/*   (same origin)
┌───────────────────────────▼──────────────────────────────────┐
│  Next.js route handler  — server-side proxy                  │
│  Backend URL and all credentials stay on the server          │
└───────────────────────────┬──────────────────────────────────┘
                            │  REST /api/v1/*
┌───────────────────────────▼──────────────────────────────────┐
│  FastAPI backend                                             │
│  routers → services → integrations                           │
│                                                              │
│  services/    job · sourcing · interview · outreach · voice  │
│  integrations/                                               │
│    hunar/          HunarVoiceProvider │ DemoVoiceProvider    │
│    people_search/  PDLProvider        │ MockProvider         │
│    llm/            AnthropicProvider  │ HeuristicProvider    │
└───────────────────────────┬──────────────────────────────────┘
                            │  SQLAlchemy + Alembic
┌───────────────────────────▼──────────────────────────────────┐
│  PostgreSQL  (SQLite fallback for zero-config local dev)     │
└──────────────────────────────────────────────────────────────┘
```

Every external dependency sits behind a protocol with two implementations — a live one and a
local one. Swapping between them changes no service, route or UI code, and the active provider is
always reported to the client so a simulation is never mistaken for a real call.

---

## Tech stack

**Frontend** — Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4,
Radix UI primitives in the shadcn/ui idiom, lucide-react, sonner. Charts are hand-built SVG so
they inherit the design tokens and add no dependency.

**Backend** — FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, httpx.

**Database** — PostgreSQL (SQLite fallback locally).

---

## Project structure

```
HR Platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/routers/    jobs, candidates, search, interviews, outreach,
│   │   │                      conversations, insights, attendance, webhooks, system
│   │   ├── core/              config, logging, error handling
│   │   ├── db/                engine, session, declarative base
│   │   ├── models/            SQLAlchemy models + enums
│   │   ├── schemas/           Pydantic request/response models
│   │   ├── services/          domain logic (interview, outreach, sourcing, matching,
│   │   │                      question bank, demo scripts, dashboard)
│   │   ├── integrations/
│   │   │   ├── hunar/         client, typed API contract, agents, live + demo providers
│   │   │   ├── people_search/ provider protocol, mock provider, PDL provider, factory
│   │   │   └── llm/           provider protocol, heuristic engine, Anthropic engine
│   │   └── main.py
│   ├── alembic/               migrations
│   ├── scripts/seed.py        demo workspace seeder
│   └── tests/                 end-to-end API smoke tests
├── frontend/
│   ├── app/
│   │   ├── (app)/             dashboard, jobs, candidates, people-search,
│   │   │                      outreach, interviews, conversations, analytics,
│   │   │                      attendance, settings
│   │   ├── api/proxy/         server-side proxy route handler
│   │   └── page.tsx           landing page
│   ├── components/            ui, dashboard, candidates, outreach, conversations,
│   │                          attendance, charts, ai, shell
│   ├── hooks/                 useApi (fetch + polling)
│   ├── lib/                   API client, formatting utilities
│   └── types/                 TypeScript mirror of the API contract
├── docs/                      architecture and API notes
└── .env.example
```

---

## Local setup

**Prerequisites:** Node.js 20+ (22.13+ recommended for Next 16), Python 3.11+.
PostgreSQL is optional — without `DATABASE_URL` the backend uses a local SQLite file.

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env             # then edit .env
alembic upgrade head
python -m scripts.seed --reset      # creates the demo workspace
uvicorn app.main:app --reload --port 8000
```

API: <http://localhost:8000> · interactive docs: <http://localhost:8000/docs>

### 2. Frontend

```bash
cd frontend
npm install
echo "BACKEND_API_URL=http://localhost:8000" > .env.local
npm run dev
```

App: <http://localhost:3000>

The app boots straight into a populated workspace — no sign-up, no configuration.

---

## Environment variables

Copy `.env.example` into `backend/.env` and `frontend/.env.local`. **No secret is ever exposed to
the browser.**

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | Environment name. `production` tightens webhook verification. |
| `SECRET_KEY` | dev value | Application secret. Set a long random value in production. |
| `DATABASE_URL` | local SQLite | PostgreSQL connection string. `postgres://` and `postgresql://` are normalised to psycopg 3. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated browser origins allowed to call the API directly. |
| `HUNAR_API_KEY` | — | **Secret.** Hunar Voice Agents API key. |
| `HUNAR_BASE_URL` | `https://api.voice.hunar.ai/external/v1` | Hunar external API base. |
| `HUNAR_DEFAULT_LANGUAGE` | `ENGLISH` | Default agent language. |
| `HUNAR_DEFAULT_VOICE_PERSONA` | `NEHA` | Default voice persona. |
| `HUNAR_FROM_PHONE_NUMBER` | — | Optional E.164 caller ID owned by your Hunar org. |
| `HUNAR_WEBHOOK_SECRET` | — | **Secret.** Verifies the `X-Hunar-Signature` HMAC. |
| `PUBLIC_BACKEND_URL` | `http://localhost:8000` | Public URL used to build Hunar callback URLs. |
| `PEOPLE_SEARCH_PROVIDER` | `mock` | `mock` or `pdl`. |
| `PDL_API_KEY` | — | **Secret.** Required when `PEOPLE_SEARCH_PROVIDER=pdl`. |
| `LLM_PROVIDER` | `heuristic` | `heuristic` (no key needed) or `anthropic`. |
| `ANTHROPIC_API_KEY` | — | **Secret.** Required when `LLM_PROVIDER=anthropic`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model id. |
| `DEMO_MODE` | `true` | `true` simulates calls; `false` places real ones. |

### Frontend (`frontend/.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_API_URL` | `http://localhost:8000` | Server-side only. Where the proxy route forwards requests. |

There is deliberately **no `NEXT_PUBLIC_*` variable** in this project — nothing about the backend
needs to reach the client bundle.

---

## Database

Migrations are managed with Alembic and are written to run unchanged on PostgreSQL and SQLite
(string UUID keys, generic `JSON` columns, batch mode for SQLite ALTERs).

```bash
alembic upgrade head                                   # apply
alembic revision --autogenerate -m "describe change"   # create
alembic downgrade -1                                   # roll back one
```

### Schema

**Recruiting** — `users`, `jobs`, `candidates`, `job_matches`, `ai_insights`, `activities`
**Voice** — `voice_calls`, `conversations`, `conversation_turns`
**Interviews** — `interviews`, `interview_questions`, `interview_answers`
**Outreach** — `outreaches`, `candidate_responses`
**Attendance** — `locations`, `employees`, `attendance_events`, `audit_logs`

Key relationships: a `job` has many `job_matches`, `interviews` and `outreaches`; a `candidate`
has many of each plus `ai_insights`; both an `interview` and an `outreach` point at one
`voice_call` and one `conversation`; a `conversation` has ordered `conversation_turns`; an
`outreach` has exactly one `candidate_response`. Every table carries `created_at` / `updated_at`.

### Seed data

```bash
python -m scripts.seed --reset
```

Produces 4 jobs, 17 candidates, 6+ interviews (completed with varied scores, plus scheduled ones),
7 outreach conversations (including one left mid-call so the live UI has something to show),
insights, an activity feed, and the attendance dataset (100 locations, 1,000 employees, ~2,900
events over 3 days).

The seeder runs everything **through the real services** — job descriptions go through the actual
parser, candidates come from the people-search provider, and calls run through the real voice
pipeline in demo mode. The seeded state is therefore reachable by clicking through the product.

---

## Hunar.ai integration

Implemented against the documented external API at
`https://api.voice.hunar.ai/external/v1` (docs: <https://api.voice.hunar.ai/docs/external/>).
Authentication is the `X-API-Key` header. No endpoint is invented.

**`backend/app/integrations/hunar/`**

| File | Responsibility |
| --- | --- |
| `models.py` | Typed Pydantic mirror of the API contract — agents, calls, numbers, webhooks, enums, retry rules |
| `client.py` | Thin HTTP client, one method per documented endpoint, with normalised error handling |
| `agents.py` | Agent blueprints: prompt, introduction, objective, `result_prompt` and `result_schema` for interviews and outreach |
| `base.py` | Provider-neutral `VoiceCallSpec` / `VoiceCallState` and the `VoiceProviderProtocol` |
| `service.py` | `HunarVoiceProvider` (live calls, agent reuse, callback config) and the provider factory |
| `demo.py` | `DemoVoiceProvider` — replays a scripted conversation on a compressed timeline |
| `webhooks.py` | HMAC-SHA256 verification of `X-Hunar-Signature` with timestamp skew checking |

**Endpoints used**

| Method | Path | Used for |
| --- | --- | --- |
| `GET` | `/agents/` | Find an existing agent before creating a duplicate |
| `POST` | `/agents/` | Create the interview / outreach agent with its result schema |
| `GET` | `/agents/{id}/` | Read agent configuration |
| `PUT` | `/agents/{id}/` | Update an agent |
| `POST` | `/calls/` | Place a call |
| `POST` | `/calls/bulk/` | Batch calls (available on the client) |
| `GET` | `/calls/{id}/` | Poll call status and result |
| `GET` | `/calls/` | List calls |
| `GET` | `/numbers/` | List caller IDs owned by the org |

**Webhooks.** Callback URLs are registered per call via `callback_config`, pointing at
`POST /api/v1/webhooks/hunar`. Deliveries are signature-verified, applied to the `voice_calls`
row, and then re-run through the same state machine used by polling — so webhook-driven and
poll-driven updates cannot diverge.

**Structured extraction.** Both agents declare a `result_schema`. The outreach schema maps
one-to-one onto the columns of `candidate_responses`; the interview schema onto the score columns
of `interviews`. The demo provider fills the *same* schema, so live and demo runs write identical
downstream records.

### Credential resilience

The Hunar key is treated as something that *will* fail eventually - expiring, being revoked, or
running out of minutes - and none of those may break the product.

- **`health.py`** performs a cached, read-only credential check (list agents, list numbers). A
  missing, rejected (401/403), out-of-credit (402) or unreachable platform is a normal result, not
  an exception. Healthy results are cached for 10 minutes, unhealthy ones for 2.
- **`ResilientVoiceProvider`** wraps both providers. It tries live, and falls back to the demo
  provider whenever the credential is unusable *or* the call itself fails - recording the reason on
  the call record. A failed live call also invalidates the health cache so the next attempt
  re-checks rather than trusting a stale "healthy".
- **Refreshes are routed by whoever placed the call**, so a simulated call is never polled against
  the live API, and vice versa.
- **`GET /api/v1/system/voice-health`** reports exactly why live calling is unavailable, without
  ever exposing the key.

The practical effect: when the key expires, the application behaves precisely as it does with no
key at all. Every workflow still completes and every screen still renders - the records simply
carry `provider: "demo"`.

### Calls that are never dialled

`services/voice_policy.py` is the single place that decides whether a specific call may go out over
real telephony. It refuses when:

- the candidate came from the mock people-search dataset (fabricated contact details);
- the number is in the reserved `+91 99999` demonstration range;
- the number is not valid E.164;
- there is no number at all.

In each case the conversation is simulated and the reason is recorded. This is why `DEMO_MODE=false`
is safe to run against seeded demo data: **live calling never dials a number that belongs to nobody.**

### Webhooks and local development

Hunar validates `callback_config` URLs and rejects the entire call if they are not publicly
reachable, so a local backend (`PUBLIC_BACKEND_URL=http://localhost:8000`) omits them and relies on
polling instead. Both paths converge on the same state machine, so the behaviour is identical.
Set `PUBLIC_BACKEND_URL` to a public HTTPS address in a deployed environment to enable webhooks.

> **Platform limitation, stated plainly.** The Hunar external API v1 exposes agents, calls and
> phone numbers. For a completed call it returns a `recording_url` and a schema-driven `result`
> object — but it does **not** expose a turn-by-turn transcript endpoint. HireFlow therefore
> treats the structured `result` as the primary machine-readable output of a live call, and stores
> whatever conversation content the platform does return (`_extract_turns` reads a transcript if
> the workspace provides one under a conventional key). Transcript timelines are always fully
> populated for demo calls; for live calls they are populated only to the extent the platform
> provides them, and the conversation UI says so rather than fabricating turns.

---

## People search integration

`PeopleSearchProvider` is a protocol with three types — `PeopleSearchQuery`, `SourcedProfile`
and `PeopleSearchResult`. Adding a vendor means writing one class and registering it in
`factory.py`; nothing above that line changes.

- **`MockPeopleSearchProvider`** (default) — filters and ranks a curated local dataset of 24
  fabricated profiles. It returns `is_live=False`, `provider="mock"` and an explicit notice, all
  of which the API and UI surface verbatim. **No external API is called and the product never
  claims one was.** Contact details use the reserved `+91 99999` range so nothing is dialable.
- **`PDLPeopleSearchProvider`** — a real People Data Labs implementation, included to prove the
  abstraction holds for a live vendor. Active only when `PEOPLE_SEARCH_PROVIDER=pdl` and
  `PDL_API_KEY` are both set; the factory raises a configuration error rather than degrading
  silently.

Apollo, Proxycurl or an internal ATS index would slot in the same way.

**Match scoring** (`services/matching.py`) is deliberately transparent: 60% skills, 25%
experience, 15% location, returning matched skills, missing skills and a written rationale.
Near-misses lose points rather than being eliminated, and over-qualification is a mild penalty
rather than a disqualifier.

---

## LLM integration

`LLMProvider` covers the three places the product reasons over text: parsing a job description,
summarising a conversation, and evaluating an interview.

- **`HeuristicLLMProvider`** (default) — deterministic, dependency-free, no API key. A curated
  skill taxonomy plus regular expressions for JD parsing, and rubric-coverage scoring for
  interview evaluation. Fast, free and reproducible in tests, and everything it returns is derived
  from the input.
- **`AnthropicLLMProvider`** — calls the Messages API for the same three operations, asking for
  strict JSON. If the model is unreachable or returns something unparseable it **falls back to the
  heuristic engine**, so a network hiccup can never break a demo.

The active engine is reported in the API response and shown in the UI.

---

## Demo mode

External APIs are not always available, and dialling real phone numbers during a demo is not
acceptable. `DEMO_MODE=true` (the default) routes calls to `DemoVoiceProvider`, which replays a
scripted conversation on a compressed timeline so a full call plays out in under a minute.

**Demo output is never disguised as real API data:**

- Records are tagged `provider="demo"` all the way to the UI.
- A persistent **Demo mode** badge sits in the app header, with an explanatory banner on the
  dashboard and before any call is placed.
- `recording_url` is deliberately `null` — there is no audio, because no call happened.
- Demo payloads carry `"simulated": true`.
- `GET /api/v1/system/status` reports the active mode for every provider.
- The mock people-search provider returns `is_live: false` plus a notice explaining that no
  external API was called.

Live calls require **both** `HUNAR_API_KEY` and `DEMO_MODE=false`, so a half-configured deployment
degrades to a safe simulation instead of unexpectedly dialling real candidates.

Demo conversations are deterministic per candidate (seeded from the candidate id), so a given
candidate performs consistently across runs — which makes the demo repeatable and the scores
explainable.

### Hearing the conversation

A simulated call produces no audio, so the live room used to animate a waveform over silence. The
transcript is now read aloud with the browser's speech synthesis (`hooks/use-speech.ts`):

- **Live calls** speak each turn as it arrives, skipping ahead if speech falls behind the
  transcript, so the voice always matches what is on screen.
- **Stored conversations** offer a *Play conversation* button that reads the whole exchange in
  order, highlighting the line being spoken.
- The agent and the candidate get **different voices** (Indian English preferred when available),
  with a pitch and rate split so they stay distinguishable even on a single-voice browser.
- Browsers block speech until a page receives a user gesture. That is detected and surfaced as a
  **"Click to enable sound"** prompt rather than failing silently, and the retry replays the turns
  it could not speak.
- The control is labelled **"Read aloud"**, never "Play recording" - what you hear is the browser
  speaking a transcript, not audio from a call. The sound preference is remembered per browser.

For a real Hunar call the platform returns a genuine `recording_url`, which the conversation view
links to instead.


---

## API reference

Full interactive documentation at `/docs`. Base path: `/api/v1`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/system/status` | Provider modes and configuration state (never secrets) |
| `GET` | `/system/voice-health` | Live Hunar credential check and why live calling is or is not available |
| `GET` | `/dashboard` | Everything the recruiter home screen needs |
| `GET` | `/analytics?days=30` | Funnel, rates, distributions, timeline |
| `GET` `POST` | `/jobs` | List / create jobs |
| `GET` `PATCH` | `/jobs/{id}` | Read / update a job |
| `POST` | `/jobs/parse-description` | Extract structured requirements from a JD |
| `GET` `POST` | `/candidates` | List (filter, sort, search) / create |
| `GET` `PATCH` | `/candidates/{id}` | Read / update a candidate |
| `GET` | `/candidates/{id}/matches` | Match scores across jobs |
| `GET` | `/candidates/{id}/timeline` | Interviews, outreach, conversations, matches |
| `POST` | `/search/candidates` | Run a people search |
| `POST` | `/search/save` | Save sourced profiles into the pool |
| `GET` `POST` | `/interviews` | List / create interviews |
| `GET` | `/interviews/focus-areas` | Focus areas the question bank supports |
| `GET` | `/interviews/{id}` | Interview detail with questions and answers |
| `POST` | `/interviews/{id}/start` | Place the interview call |
| `POST` | `/interviews/{id}/complete` | Fast-forward to the evaluated result |
| `GET` | `/interviews/{id}/live` | Poll-friendly live state |
| `GET` | `/interviews/{id}/conversation` | Stored conversation |
| `GET` `POST` | `/outreach` | List / queue an outreach batch |
| `GET` | `/outreach/{id}` | Outreach detail with extracted response |
| `POST` | `/outreach/{id}/start` | Place the call |
| `POST` | `/outreach/{id}/complete` | Fast-forward to the extracted result |
| `GET` | `/outreach/{id}/live` | Poll-friendly live state |
| `GET` | `/outreach/{id}/conversation` | Stored conversation |
| `GET` | `/conversations` | List conversations |
| `GET` | `/conversations/{id}` | Transcript, extraction and call record |
| `GET` | `/attendance/overview` | Attendance roll-up, recent events, audit log |
| `GET` | `/attendance/locations` | Location directory |
| `POST` | `/webhooks/hunar` | Signature-verified Hunar callback |

**Error envelope** — every failure returns the same shape, and internal detail is never leaked:

```json
{ "error": { "code": "not_found", "message": "Candidate abc was not found.", "details": [] } }
```

---

## Testing

```bash
# Backend
cd backend
pytest -q                       # end-to-end API smoke tests
ruff check app scripts tests    # lint
ruff format app scripts tests   # format

# Frontend
cd frontend
npm run typecheck               # tsc --noEmit (strict)
npm run lint                    # ESLint
npm run build                   # production build
```

The backend suite walks the whole vertical against a throwaway database — JD parsing → people
search → sourcing → outreach → structured extraction → interview → evaluation — and asserts that
mock results are labelled as mock, demo calls are tagged `provider="demo"`, secrets never appear
in `/system/status`, and unknown ids return clean 404s with no stack trace.

`tests/conftest.py` points the suite at its own SQLite file before the app is imported, so running
tests can never write into your development or demo data.

**Verified manually:** dashboard, jobs list and detail, candidate list/filters/profile, JD parse →
search → save → outreach, the live interview room (progressive transcript, elapsed timer, current
question, progress), the completed scorecard, outreach live and completed views, conversations,
analytics, the attendance page, mobile layout, and API-failure states.

---

## Security

- **API keys are server-side only.** The browser talks exclusively to a Next.js route handler at
  `/api/proxy/*`, which forwards to the backend. The backend URL and every credential stay out of
  the client bundle — there is no `NEXT_PUBLIC_*` variable in this project.
- **Secrets come from the environment.** Nothing is hardcoded, and `.env` is git-ignored while
  `.env.example` documents every variable.
- **Configuration is never echoed.** `/system/status` reports *whether* a provider is configured,
  never the value.
- **Webhooks are verified.** HMAC-SHA256 over the signed payload with timestamp skew checking, and
  unverifiable deliveries are rejected outright in production.
- **Input is validated.** Pydantic models validate every request and response; query parameters are
  bounded and pattern-constrained.
- **Errors are safe.** A global handler logs the traceback server-side and returns a generic 500.
  No stack trace reaches a client.
- **CORS is explicit.** Origins come from `CORS_ORIGINS`; the default is localhost only.
- **Live calls are fail-safe.** Real dialling requires both an API key and `DEMO_MODE=false`.
- **Demo contact data is unusable.** Mock phone numbers use the reserved `+91 99999` range.

The repository was scanned for committed secrets before delivery; the only key-shaped strings are
placeholder names in `.env.example` and documentation.

---

## Deployment

### Frontend → Vercel

1. Import the repo and set the root directory to `frontend`.
2. Environment variable: `BACKEND_API_URL=https://<your-backend-host>`.
3. Deploy. Build command `npm run build`, output handled by the Next.js preset.

Because the browser only calls same-origin `/api/proxy/*`, no CORS configuration is needed for the
normal deployment shape.

### Backend → Render / Railway / Fly.io / any container host

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Production environment variables:

```
APP_ENV=production
SECRET_KEY=<long random string>
DATABASE_URL=postgresql+psycopg://…
CORS_ORIGINS=https://<your-frontend-host>
PUBLIC_BACKEND_URL=https://<your-backend-host>
HUNAR_API_KEY=<secret>
HUNAR_WEBHOOK_SECRET=<secret>
DEMO_MODE=false
```

### Database → Supabase or managed PostgreSQL

Set `DATABASE_URL` to the connection string (the pooled connection string works; `postgres://`
and `postgresql://` forms are normalised automatically) and run `alembic upgrade head`.
Optionally run `python -m scripts.seed` to populate a demo workspace.

### Deployment checklist

- [ ] `PUBLIC_BACKEND_URL` is the real HTTPS backend URL — Hunar webhook callbacks are built from it
- [ ] `CORS_ORIGINS` lists the deployed frontend origin
- [ ] `BACKEND_API_URL` on Vercel points at the deployed backend
- [ ] `alembic upgrade head` has run against the production database
- [ ] `DEMO_MODE=false` only when you genuinely intend to dial real numbers
- [ ] `HUNAR_WEBHOOK_SECRET` is set (webhooks are rejected without it in production)
- [ ] No `localhost` remains in any production environment variable

---

## Known limitations

1. **No transcript endpoint upstream.** The Hunar external API returns a recording URL and a
   structured result for a completed call, not a turn-by-turn transcript. Live-call transcripts are
   therefore populated only from webhook content when a workspace provides it; demo calls always
   have full timelines. The UI states which it is showing rather than inventing turns.
2. **Authentication is a demo identity.** The brief called for a lightweight entry rather than
   enterprise auth, so there is a single seeded recruiter and no login. Real deployment needs
   sessions, RBAC and per-tenant scoping.
3. **Calls run inline.** `start` places the call within the request. Production should hand this to
   a task queue with retries and rate limiting, particularly for large batches.
4. **Polling, not streaming.** Live screens poll (1.5s during a call). WebSockets or SSE would be
   better at scale.
5. **The heuristic engine is a rules engine.** Good, explainable and free — but it recognises only
   the skills in its taxonomy. Set `LLM_PROVIDER=anthropic` for open-vocabulary parsing.
6. **The attendance voice pipeline is a design, not an implementation.** Schema, APIs and dashboard
   are real; the IVR is specified rather than built.
7. **Bulk outreach is sequential** and stops short of pagination on very large result sets.

---

## Future improvements

- Move call orchestration to a background worker (Celery/RQ or Cloud Tasks) with retry policies.
- Replace polling with SSE or WebSockets for live call surfaces.
- Real authentication with organisations, roles and per-tenant data isolation.
- Candidate-facing scheduling so interviews are booked rather than dialled cold.
- Resume/CV parsing to enrich sourced profiles beyond provider data.
- Calibrate interview rubrics against real hiring outcomes, and track scorer drift.
- Bias auditing on match and interview scores, with reporting per protected attribute.
- Implement the attendance IVR against the same Hunar agent abstraction.
- E2E browser tests (Playwright) alongside the API suite.

---

Built for the Hunar.ai assignment. Voice by [Hunar.ai](https://api.voice.hunar.ai/docs/external/).
