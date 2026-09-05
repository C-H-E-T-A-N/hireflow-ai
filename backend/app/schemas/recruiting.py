from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import (
    AvailabilityStatus,
    CandidateStage,
    EmploymentType,
    JobStatus,
)
from app.schemas.common import ORMModel

# --- Jobs ---------------------------------------------------------------------


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    department: str | None = None
    location: str | None = None
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    status: JobStatus = JobStatus.OPEN
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str = "INR"


class JobUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    department: str | None = None
    location: str | None = None
    employment_type: EmploymentType | None = None
    status: JobStatus | None = None
    salary_min: int | None = None
    salary_max: int | None = None


class JobRead(ORMModel):
    id: str
    title: str
    department: str | None
    location: str | None
    employment_type: str
    status: str
    description: str
    required_skills: list[str]
    nice_to_have_skills: list[str]
    min_experience_years: float | None
    max_experience_years: float | None
    seniority: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str
    parsed_requirements: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class JobSummary(ORMModel):
    id: str
    title: str
    location: str | None
    status: str
    required_skills: list[str]


class JobStats(JobRead):
    candidate_count: int = 0
    interview_count: int = 0
    outreach_count: int = 0


# --- Job description parsing --------------------------------------------------


class ParseJDRequest(BaseModel):
    description: str = Field(min_length=20, max_length=20000)


class ParsedRequirements(BaseModel):
    title: str | None = None
    seniority: str | None = None
    employment_type: str | None = None
    required_skills: list[str] = []
    nice_to_have_skills: list[str] = []
    min_experience_years: float | None = None
    max_experience_years: float | None = None
    locations: list[str] = []
    responsibilities: list[str] = []
    keywords: list[str] = []
    summary: str | None = None
    engine: str = "heuristic"


# --- Candidates ---------------------------------------------------------------


class MatchRead(ORMModel):
    id: str
    job_id: str
    candidate_id: str
    score: float
    skill_score: float
    experience_score: float
    location_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    rationale: str | None


class CandidateRead(ORMModel):
    id: str
    full_name: str
    email: str | None
    phone: str | None
    headline: str | None
    current_title: str | None
    current_company: str | None
    location: str | None
    country: str | None
    avatar_url: str | None
    linkedin_url: str | None
    github_url: str | None
    experience_years: float | None
    skills: list[str]
    education: list[dict[str, Any]]
    experience: list[dict[str, Any]]
    summary: str | None
    stage: str
    source: str
    source_provider: str | None
    availability: str
    notice_period_days: int | None
    expected_ctc: str | None
    last_activity_at: datetime | None
    created_at: datetime


class CandidateListItem(ORMModel):
    id: str
    full_name: str
    current_title: str | None
    current_company: str | None
    location: str | None
    avatar_url: str | None
    experience_years: float | None
    skills: list[str]
    stage: str
    availability: str
    last_activity_at: datetime | None
    match_score: float | None = None


class CandidateUpdate(BaseModel):
    stage: CandidateStage | None = None
    availability: AvailabilityStatus | None = None
    notice_period_days: int | None = None
    expected_ctc: str | None = None
    phone: str | None = None
    email: str | None = None


class CandidateCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: str | None = None
    phone: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    experience_years: float | None = None
    skills: list[str] = []
    summary: str | None = None


# --- People search ------------------------------------------------------------


class PeopleSearchRequest(BaseModel):
    job_id: str | None = None
    description: str | None = None
    titles: list[str] = []
    skills: list[str] = []
    locations: list[str] = []
    min_experience_years: float | None = None
    max_experience_years: float | None = None
    keywords: list[str] = []
    limit: int = Field(default=25, ge=1, le=100)
    provider: str | None = None


class SourcedProfileRead(BaseModel):
    provider: str
    provider_profile_id: str
    full_name: str
    headline: str | None
    current_title: str | None
    current_company: str | None
    location: str | None
    country: str | None
    experience_years: float | None
    skills: list[str]
    email: str | None
    phone: str | None
    linkedin_url: str | None
    github_url: str | None
    summary: str | None
    education: list[dict[str, Any]]
    experience: list[dict[str, Any]]
    availability_hint: str | None
    match: MatchPreview | None = None
    candidate_id: str | None = None


class MatchPreview(BaseModel):
    score: float
    skill_score: float
    experience_score: float
    location_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    rationale: str


class PeopleSearchResponse(BaseModel):
    provider: str
    # False whenever results came from the built-in mock dataset.
    is_live: bool
    total: int
    notice: str | None = None
    parsed_requirements: ParsedRequirements | None = None
    results: list[SourcedProfileRead]


class SaveProfilesRequest(BaseModel):
    job_id: str | None = None
    profiles: list[dict[str, Any]] = Field(min_length=1)


SourcedProfileRead.model_rebuild()
