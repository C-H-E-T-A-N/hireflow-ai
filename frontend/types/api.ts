/**
 * TypeScript mirror of the FastAPI response models.
 * Keep in sync with backend/app/schemas/*.
 */

export type CandidateStage =
  | "sourced"
  | "contacted"
  | "interested"
  | "not_interested"
  | "interview_scheduled"
  | "interview_completed"
  | "shortlisted"
  | "rejected"
  | "hired";

export type InterviewStatus =
  | "draft"
  | "scheduled"
  | "dialing"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type OutreachStatus =
  | "queued"
  | "dialing"
  | "in_progress"
  | "processing"
  | "completed"
  | "no_answer"
  | "failed"
  | "cancelled";

export type Recommendation = "strong_hire" | "shortlist" | "consider" | "reject" | "pending";

export type OutreachRecommendation =
  | "high_potential"
  | "worth_pursuing"
  | "nurture"
  | "disqualify"
  | "pending";

export type InterestLevel = "interested" | "not_interested" | "maybe_later" | "unknown";

export type Availability =
  | "immediate"
  | "one_month"
  | "two_months"
  | "three_months_plus"
  | "not_looking"
  | "unknown";

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: unknown };
}

/* --- Jobs ---------------------------------------------------------------- */

export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  status: string;
  description: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  min_experience_years: number | null;
  max_experience_years: number | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  parsed_requirements: ParsedRequirements | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export interface JobStats extends Job {
  candidate_count: number;
  interview_count: number;
  outreach_count: number;
}

export interface JobSummary {
  id: string;
  title: string;
  location: string | null;
  status: string;
  required_skills: string[];
}

export interface ParsedRequirements {
  title: string | null;
  seniority: string | null;
  employment_type: string | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  min_experience_years: number | null;
  max_experience_years: number | null;
  locations: string[];
  responsibilities: string[];
  keywords: string[];
  summary: string | null;
  engine: string;
}

/* --- Candidates ---------------------------------------------------------- */

export interface CandidateListItem {
  id: string;
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  avatar_url: string | null;
  experience_years: number | null;
  skills: string[];
  stage: CandidateStage;
  availability: Availability;
  last_activity_at: string | null;
  match_score: number | null;
}

export interface Candidate extends Omit<CandidateListItem, "match_score"> {
  email: string | null;
  phone: string | null;
  headline: string | null;
  country: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  education: Array<{ school?: string; degree?: string; year?: number | string }>;
  experience: Array<{ title?: string; company?: string; start?: string; end?: string }>;
  summary: string | null;
  source: string;
  source_provider: string | null;
  notice_period_days: number | null;
  expected_ctc: string | null;
  created_at: string;
}

export interface JobMatch {
  id: string;
  job_id: string;
  candidate_id: string;
  score: number;
  skill_score: number;
  experience_score: number;
  location_score: number;
  matched_skills: string[];
  missing_skills: string[];
  rationale: string | null;
  job_title?: string | null;
}

/* --- People search ------------------------------------------------------- */

export interface MatchPreview {
  score: number;
  skill_score: number;
  experience_score: number;
  location_score: number;
  matched_skills: string[];
  missing_skills: string[];
  rationale: string;
}

export interface SourcedProfile {
  provider: string;
  provider_profile_id: string;
  full_name: string;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[];
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  summary: string | null;
  education: Array<Record<string, unknown>>;
  experience: Array<Record<string, unknown>>;
  availability_hint: string | null;
  match: MatchPreview | null;
  candidate_id: string | null;
}

export interface PeopleSearchResponse {
  provider: string;
  /** False whenever results came from the built-in mock dataset. */
  is_live: boolean;
  total: number;
  notice: string | null;
  parsed_requirements: ParsedRequirements | null;
  results: SourcedProfile[];
}

/* --- Conversations ------------------------------------------------------- */

export interface ConversationTurn {
  id: string;
  sequence: number;
  speaker: "agent" | "candidate" | "system";
  content: string;
  offset_seconds: number | null;
  meta: Record<string, unknown>;
}

export interface VoiceCall {
  id: string;
  provider: string;
  provider_call_id: string | null;
  status: string;
  lifecycle_status: string;
  recording_url: string | null;
  duration_seconds: number | null;
  answered_by: string | null;
  engagement_status: string | null;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
}

export interface Conversation {
  id: string;
  channel: "voice_interview" | "voice_outreach";
  status: "active" | "analyzing" | "completed" | "failed";
  title: string | null;
  candidate_id: string | null;
  job_id: string | null;
  summary: string | null;
  sentiment: string | null;
  extracted_data: Record<string, unknown>;
  created_at: string;
  turns: ConversationTurn[];
  voice_call: VoiceCall | null;
}

export interface ConversationListItem {
  id: string;
  channel: "voice_interview" | "voice_outreach";
  status: string;
  title: string | null;
  candidate_id: string | null;
  summary: string | null;
  sentiment: string | null;
  created_at: string;
  turn_count: number;
}

/* --- Interviews ---------------------------------------------------------- */

export interface InterviewAnswer {
  id: string;
  transcript: string;
  score: number | null;
  signals_detected: string[];
  assessment: string | null;
  answered_at: string | null;
}

export interface InterviewQuestion {
  id: string;
  sequence: number;
  prompt: string;
  focus_area: string | null;
  competency: string | null;
  expected_signals: string[];
  weight: number;
  answer: InterviewAnswer | null;
}

export interface Interview {
  id: string;
  job_id: string;
  candidate_id: string;
  conversation_id: string | null;
  title: string;
  interview_type: string;
  difficulty: string;
  duration_minutes: number;
  focus_areas: string[];
  language: string;
  agent_persona_name: string;
  voice_persona: string;
  intro_message: string | null;
  notes: string | null;
  status: InterviewStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  current_question_index: number;
  error_message: string | null;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  problem_solving_score: number | null;
  role_fit_score: number | null;
  recommendation: Recommendation;
  evaluation_summary: string | null;
  strengths: string[];
  concerns: string[];
  evaluation_detail: Record<string, unknown> & { per_competency?: Record<string, number> };
  created_at: string;
}

export interface InterviewDetail extends Interview {
  candidate: CandidateListItem | null;
  job: JobSummary | null;
  questions: InterviewQuestion[];
  voice_call: VoiceCall | null;
}

export interface InterviewListItem {
  id: string;
  title: string;
  status: InterviewStatus;
  interview_type: string;
  difficulty: string;
  duration_minutes: number;
  overall_score: number | null;
  recommendation: Recommendation;
  scheduled_at: string | null;
  created_at: string;
  candidate: CandidateListItem | null;
  job: JobSummary | null;
}

export interface InterviewLiveState {
  id: string;
  status: InterviewStatus;
  elapsed_seconds: number;
  current_question_index: number;
  total_questions: number;
  current_question: string | null;
  provider: string;
  call_status: string | null;
  turns: ConversationTurn[];
  overall_score: number | null;
  recommendation: Recommendation | null;
}

/* --- Outreach ------------------------------------------------------------ */

export interface CandidateResponse {
  id: string;
  interest_level: InterestLevel;
  current_role: string | null;
  current_company: string | null;
  experience_years: number | null;
  current_location: string | null;
  notice_period_days: number | null;
  expected_compensation: string | null;
  relevant_skills: string[];
  availability: string | null;
  reason_for_interest: string | null;
  open_to_relocate: boolean | null;
  ai_summary: string | null;
  ai_recommendation: OutreachRecommendation;
  confidence: number | null;
}

export interface Outreach {
  id: string;
  job_id: string;
  candidate_id: string;
  conversation_id: string | null;
  campaign_name: string | null;
  agent_persona_name: string;
  language: string;
  talking_points: string[];
  status: OutreachStatus;
  attempt_count: number;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  response: CandidateResponse | null;
}

export interface OutreachDetail extends Outreach {
  candidate: CandidateListItem | null;
  job: JobSummary | null;
  voice_call: VoiceCall | null;
}

export interface OutreachLiveState {
  id: string;
  status: OutreachStatus;
  elapsed_seconds: number;
  provider: string;
  call_status: string | null;
  turns: ConversationTurn[];
  response: CandidateResponse | null;
}

/* --- Dashboard & analytics ----------------------------------------------- */

export interface MetricCard {
  key: string;
  label: string;
  value: number;
  delta: number | null;
  hint: string | null;
  unit: string | null;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
}

export interface DashboardResponse {
  metrics: MetricCard[];
  pipeline: PipelineStage[];
  recent_candidates: Array<{
    id: string;
    full_name: string;
    current_title: string | null;
    avatar_url: string | null;
    stage: CandidateStage;
    match_score: number | null;
    role: string | null;
    last_activity_at: string | null;
  }>;
  upcoming_interviews: Array<{
    id: string;
    title: string;
    status: InterviewStatus;
    scheduled_at: string | null;
    duration_minutes: number;
    candidate_name: string | null;
    candidate_id: string | null;
    job_title: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string;
    actor: string;
    created_at: string;
    candidate_id: string | null;
    job_id: string | null;
  }>;
  insights: Array<{
    id: string;
    title: string;
    body: string;
    severity: "positive" | "info" | "warning" | "critical";
    action_label: string | null;
    action_href: string | null;
  }>;
}

export interface AnalyticsResponse {
  period_days: number;
  metrics: MetricCard[];
  funnel: Array<{ stage: string; count: number; percent: number }>;
  interest_split: Array<{ label: string; value: number }>;
  score_distribution: Array<{ bucket: string; count: number }>;
  interest_rate: number;
  activity_timeline: Array<{
    date: string;
    sourced: number;
    outreach: number;
    interviews: number;
  }>;
}

/* --- System -------------------------------------------------------------- */

export interface SystemStatus {
  app_name: string;
  environment: string;
  demo_mode: boolean;
  voice_mode: "live" | "demo";
  providers: Array<{ name: string; mode: string; configured: boolean; detail: string }>;
  available_people_search_providers: string[];
  available_focus_areas: string[];
}

/* --- Attendance ---------------------------------------------------------- */

export interface AttendanceOverview {
  total_employees: number;
  total_locations: number;
  marked_today: number;
  present: number;
  late: number;
  flagged: number;
  verification_split: Array<{ label: string; value: number }>;
  by_location: Array<{
    location_id: string;
    name: string;
    code: string | null;
    marked: number;
    headcount: number;
    rate: number;
  }>;
  recent_events: Array<{
    id: string;
    employee_name: string;
    employee_code: string;
    location_name: string | null;
    location_code: string | null;
    work_date: string;
    check_in_at: string | null;
    status: string;
    verification_method: string;
    voice_match_confidence: number | null;
    flagged_reason: string | null;
  }>;
  audit_logs: Array<{
    id: string;
    entity_type: string;
    entity_id: string | null;
    action: string;
    actor: string;
    detail: string | null;
    created_at: string;
  }>;
}
