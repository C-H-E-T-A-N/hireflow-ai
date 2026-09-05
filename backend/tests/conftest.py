"""Test configuration.

Point the test suite at a throwaway database *before* the application package is
imported, so running tests can never write into the development or demo data.
`app.core.config.Settings` reads the environment at import time, hence the
os.environ assignment at module scope rather than in a fixture.
"""

from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).resolve().parent / "test_hireflow.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["DEMO_MODE"] = "true"
os.environ["PEOPLE_SEARCH_PROVIDER"] = "mock"
os.environ["LLM_PROVIDER"] = "heuristic"
# Never let a stray key make the suite place a real call.
os.environ.pop("HUNAR_API_KEY", None)

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _fresh_database():
    """Start each run from an empty database and clean up afterwards."""
    if TEST_DB.exists():
        TEST_DB.unlink()
    yield

    # Release the pooled connection first; Windows will not delete an open file.
    from app.db.session import engine

    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink()
