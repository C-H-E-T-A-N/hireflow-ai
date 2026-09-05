"""End-to-end smoke tests over the public API.

Each test runs against a throwaway SQLite database seeded through the real
services, so a passing run proves the whole vertical works: JD parsing ->
people search -> sourcing -> outreach -> interview -> evaluation.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.session import engine
from app.main import app
from app.models import Base

PREFIX = "/api/v1"


@pytest.fixture(scope="module", autouse=True)
def _schema():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def job(client):
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "title": "Senior Full Stack Developer",
            "location": "Gurgaon, Delhi NCR",
            "description": (
                "We need a Senior Full Stack Developer with 4+ years of experience. "
                "You will work with React, Node.js, TypeScript, MongoDB and REST APIs. "
                "Nice to have: AWS and Docker."
            ),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client):
    assert client.get(f"{PREFIX}/health").json()["status"] == "ok"


def test_system_status_never_leaks_secrets(client):
    body = client.get(f"{PREFIX}/system/status").text
    assert "api_key" not in body.lower()
    assert "secret" not in body.lower()


def test_jd_parsing_extracts_requirements(client):
    response = client.post(
        f"{PREFIX}/jobs/parse-description",
        json={
            "description": (
                "Frontend Engineer needed with 3+ years experience in React, "
                "TypeScript and Next.js, based in Bengaluru. Nice to have GraphQL."
            )
        },
    )
    assert response.status_code == 200
    parsed = response.json()
    assert "React" in parsed["required_skills"]
    assert "TypeScript" in parsed["required_skills"]
    assert parsed["min_experience_years"] == 3.0
    assert "Bengaluru" in parsed["locations"]
    assert "GraphQL" in parsed["nice_to_have_skills"]


def test_job_creation_parses_description(job):
    assert "React" in job["required_skills"]
    assert job["min_experience_years"] == 4.0


def test_people_search_is_labelled_as_mock(client, job):
    response = client.post(f"{PREFIX}/search/candidates", json={"job_id": job["id"], "limit": 10})
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "mock"
    # The API must never claim a live search happened when it did not.
    assert payload["is_live"] is False
    assert payload["results"], "expected the mock provider to return profiles"
    assert payload["results"][0]["match"]["score"] > 0


@pytest.fixture(scope="module")
def candidate(client, job):
    results = client.post(
        f"{PREFIX}/search/candidates", json={"job_id": job["id"], "limit": 5}
    ).json()["results"]
    saved = client.post(
        f"{PREFIX}/search/save",
        json={"job_id": job["id"], "profiles": [results[0]]},
    )
    assert saved.status_code == 201, saved.text
    return saved.json()["items"][0]


def test_saved_candidate_appears_in_pool(client, candidate):
    listing = client.get(f"{PREFIX}/candidates").json()
    assert any(item["id"] == candidate["id"] for item in listing["items"])


def test_outreach_call_extracts_structured_response(client, job, candidate):
    created = client.post(
        f"{PREFIX}/outreach",
        json={"job_id": job["id"], "candidate_ids": [candidate["id"]]},
    )
    assert created.status_code == 201, created.text
    outreach_id = created.json()["items"][0]["id"]

    completed = client.post(f"{PREFIX}/outreach/{outreach_id}/complete").json()
    assert completed["status"] == "completed"

    response = completed["response"]
    assert response is not None
    assert response["interest_level"] in {
        "interested",
        "not_interested",
        "maybe_later",
        "unknown",
    }
    assert response["ai_summary"]

    conversation = client.get(f"{PREFIX}/outreach/{outreach_id}/conversation").json()
    assert len(conversation["turns"]) >= 6
    assert {turn["speaker"] for turn in conversation["turns"]} == {"agent", "candidate"}
    # Demo calls must be traceable as demo calls.
    assert conversation["voice_call"]["provider"] == "demo"


def test_interview_runs_and_produces_a_scorecard(client, job, candidate):
    created = client.post(
        f"{PREFIX}/interviews",
        json={
            "job_id": job["id"],
            "candidate_id": candidate["id"],
            "difficulty": "intermediate",
            "duration_minutes": 30,
            "focus_areas": ["React", "Node.js", "System Design"],
        },
    )
    assert created.status_code == 201, created.text
    interview = created.json()
    assert len(interview["questions"]) >= 3

    started = client.post(f"{PREFIX}/interviews/{interview['id']}/start")
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "dialing"

    live = client.get(f"{PREFIX}/interviews/{interview['id']}/live").json()
    assert live["total_questions"] == len(interview["questions"])

    finished = client.post(f"{PREFIX}/interviews/{interview['id']}/complete").json()
    assert finished["status"] == "completed"
    assert 0 <= finished["overall_score"] <= 100
    assert finished["recommendation"] in {"strong_hire", "shortlist", "consider", "reject"}
    assert finished["evaluation_summary"]
    # Every question must have an answer record attached.
    assert all(question["answer"] is not None for question in finished["questions"])


def test_dashboard_and_analytics_render(client):
    dashboard = client.get(f"{PREFIX}/dashboard").json()
    assert len(dashboard["metrics"]) == 4
    assert dashboard["pipeline"]

    analytics = client.get(f"{PREFIX}/analytics").json()
    assert analytics["funnel"]
    assert analytics["activity_timeline"]


def test_unknown_ids_return_clean_404s(client):
    response = client.get(f"{PREFIX}/candidates/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    # No stack traces or internal detail may leak.
    assert "Traceback" not in response.text
