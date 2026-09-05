/**
 * Written content for the attendance system-design section.
 *
 * Kept out of the page component so the design narrative stays readable and
 * easy to revise without touching layout code.
 */

export interface StageDetail {
  id: string;
  title: string;
  summary: string;
  points: string[];
  /** The concrete failure this stage is designed to survive. */
  failureMode?: string;
}

export const STAGE_DETAILS: Record<string, StageDetail> = {
  employee: {
    id: "employee",
    title: "The employee",
    summary:
      "The only thing an employee needs is the ability to make a phone call. No app, no smartphone, no data connection, no literacy requirement.",
    points: [
      "Works from a personal feature phone, a landline, or a shared handset at the site entrance.",
      "The agent speaks the employee's language — Hunar supports Hindi, Tamil, Telugu, Kannada, Marathi, Malayalam, Gujarati and Bengali alongside English.",
      "The whole interaction is under 25 seconds, which matters when 40 people are queuing at a shared phone at 9am.",
      "Employees who cannot call at all are covered by the supervisor override path, which is logged as such.",
    ],
    failureMode:
      "An employee has no phone of their own: every site has a wall-mounted handset dedicated to check-in.",
  },
  telephony: {
    id: "telephony",
    title: "Telephony and IVR entry",
    summary:
      "Each of the 100 locations gets its own inbound number (DID). The number dialled is the first and cheapest piece of evidence about where the employee is.",
    points: [
      "A dedicated DID per site means location is asserted by infrastructure, not by the employee's word.",
      "The carrier absorbs the concurrency spike at shift boundaries; the application never sees a ringing phone.",
      "Inbound is preferred over outbound: 1,000 outbound calls cost money and annoy people, 1,000 inbound calls cost almost nothing.",
      "A missed call trigger is available as a zero-cost fallback — the employee rings and hangs up, and the system calls back.",
    ],
    failureMode:
      "A site's DID goes down: calls fail over to a regional number, and the agent then asks for the site code explicitly.",
  },
  agent: {
    id: "agent",
    title: "Voice AI conversation",
    summary:
      "A Hunar voice agent answers, runs a fixed three-question script, and returns a structured result — the same agent/result-schema mechanism HireFlow already uses for recruiting calls.",
    points: [
      "Script: confirm identity, confirm the employee is on site, confirm check-in or check-out.",
      "The agent's result_schema returns employee_code, intent (check_in / check_out), and a confidence value — not free text.",
      "Conversation state is stateless per call; everything durable is written by the attendance service.",
      "Barge-in is enabled so a regular caller can answer before the prompt finishes and be off the line in 12 seconds.",
    ],
    failureMode:
      "Speech is unintelligible after two attempts: the agent falls back to DTMF keypad entry of the employee code.",
  },
  identity: {
    id: "identity",
    title: "Identity verification",
    summary:
      "Three layers, cheapest first. Most check-ins never get past the first one.",
    points: [
      "Layer 1 — caller ID: the calling number is matched against the employee record. Sufficient on its own only when combined with layer 2 or 3.",
      "Layer 2 — voiceprint: a speaker-verification embedding captured at onboarding is compared against the live audio. Above 0.75 confidence the check-in is accepted automatically.",
      "Layer 3 — spoken or keyed PIN: used when there is no enrolled voiceprint, when confidence is low, or when the call comes from an unrecognised number.",
      "We store an irreversible embedding, never raw audio. Enrolment is explicit and consented, and an employee can re-enrol at any time.",
    ],
    failureMode:
      "Voice match lands between 0.5 and 0.75: attendance is recorded as pending_review and a supervisor confirms it, so the employee is never simply marked absent.",
  },
  location: {
    id: "location",
    title: "Location verification",
    summary:
      "Without GPS, location is established by correlating several weak signals into one strong one.",
    points: [
      "Primary: the DID that was dialled maps to exactly one site.",
      "Secondary: the cell tower / carrier region on the inbound call is compared to the site's expected region.",
      "Tertiary: for sites that need it, the agent asks for a daily rotating site code posted on the noticeboard — it changes every day, so it cannot be shared in advance.",
      "Anomalies are scored, not blocked: a mismatch downgrades the record to pending_review rather than rejecting a genuine employee at the gate.",
    ],
    failureMode:
      "An employee legitimately works from a different site: the record is flagged, the supervisor confirms, and the employee's home location is updated.",
  },
  attendance: {
    id: "attendance",
    title: "Attendance processing",
    summary:
      "A small, boring service. It applies shift rules, enforces idempotency, and writes exactly one row per employee per day per event type.",
    points: [
      "Idempotency key is (employee_id, work_date, event_type) — calling three times cannot create three check-ins.",
      "Shift rules per location: shift start plus a grace window decides present versus late.",
      "Anyone with no check-in event by the end of the shift window is marked absent by a nightly job, so absence is an explicit decision rather than missing data.",
      "Check-out is optional and never blocks payroll; check-in is the record that matters.",
    ],
    failureMode:
      "The service is down: the telephony webhook is queued and replayed, so a call that connected is never lost.",
  },
  database: {
    id: "database",
    title: "Storage and audit",
    summary:
      "PostgreSQL, partitioned by work date. Attendance is payroll data, so every decision that produced a row is recoverable.",
    points: [
      "attendance_events is the fact table; employees and locations are the dimensions.",
      "audit_logs is append-only: who or what wrote a record, from which number, with what verification method and confidence.",
      "Records are corrected by writing a new versioned row, never by overwriting — a payroll dispute six months later can be reconstructed.",
      "Voiceprint references are stored as opaque ids pointing at the verification vendor; no biometric material sits in our database.",
    ],
  },
  dashboard: {
    id: "dashboard",
    title: "HR dashboard",
    summary:
      "HR does not want 1,000 rows. They want the handful that need a human decision, and a clean export for payroll.",
    points: [
      "A single roll-up across all 100 sites, refreshed as calls land.",
      "An exceptions queue: pending_review records, sites well below their usual check-in rate, and repeat anomalies.",
      "One-click payroll export for a date range, with the verification method on every row.",
      "Per-site drill-down so a regional manager can see only their locations.",
    ],
  },
};

export interface FraudControl {
  risk: string;
  control: string;
}

export const FRAUD_CONTROLS: FraudControl[] = [
  {
    risk: "Buddy punching — a colleague calls in on someone else's behalf",
    control:
      "Speaker verification against the enrolled voiceprint. A different speaker fails the match and the record drops to pending_review rather than being silently accepted.",
  },
  {
    risk: "Calling from home instead of from the site",
    control:
      "Site-specific DIDs plus carrier region correlation. A check-in from the wrong region is flagged; sites with a history of abuse enable the daily rotating site code.",
  },
  {
    risk: "Playing back a recording of the employee's voice",
    control:
      "The agent asks for a value that changes daily (the site code or the current date), so a fixed recording cannot answer it. Liveness detection sits on top for high-risk sites.",
  },
  {
    risk: "Repeated check-ins to manufacture overtime",
    control:
      "Idempotency on (employee, date, event type). Extra calls update nothing and are logged as duplicates.",
  },
  {
    risk: "A supervisor marking their whole team present",
    control:
      "Supervisor overrides are a distinct verification_method, are rate-limited per supervisor per day, and surface on the exceptions queue for review.",
  },
  {
    risk: "Number spoofing to impersonate a known caller ID",
    control:
      "Caller ID alone never authorises a check-in; it only lowers friction. A voiceprint or PIN is always required alongside it.",
  },
];

export interface FailureScenario {
  scenario: string;
  handling: string;
}

export const FAILURE_SCENARIOS: FailureScenario[] = [
  {
    scenario: "The employee has no network coverage",
    handling:
      "The site handset is on a landline. Failing that, the supervisor records attendance with an override that is explicitly labelled as such.",
  },
  {
    scenario: "The voice AI provider is unavailable",
    handling:
      "The IVR degrades to a DTMF-only flow: enter employee code, enter PIN. It is worse UX and it still records attendance correctly.",
  },
  {
    scenario: "The attendance service is down when a call completes",
    handling:
      "Telephony webhooks are queued with retries and replayed on recovery. Idempotency keys make replay safe.",
  },
  {
    scenario: "The call drops mid-conversation",
    handling:
      "Nothing partial is written. The employee simply calls back; the interaction is short enough that a retry costs 20 seconds.",
  },
  {
    scenario: "A whole site's phone line fails",
    handling:
      "Regional fallback number, plus a bulk supervisor attestation path that records every employee individually with the override method and a reason.",
  },
  {
    scenario: "Voiceprint enrolment is missing for a new joiner",
    handling:
      "PIN-based verification is used until enrolment happens; the dashboard tracks unenrolled employees so HR can close the gap.",
  },
];

export interface ScalePoint {
  metric: string;
  value: string;
  detail: string;
}

export const SCALE_POINTS: ScalePoint[] = [
  {
    metric: "Daily call volume",
    value: "~2,000",
    detail: "1,000 employees × check-in and check-out. Trivial for a telephony platform.",
  },
  {
    metric: "Peak concurrency",
    value: "~120 calls",
    detail:
      "Check-ins bunch into a 20-minute window at shift start. Staggering shift times across sites flattens the spike further.",
  },
  {
    metric: "Call duration",
    value: "18–25s",
    detail: "A three-question script. Short calls keep both cost and queueing down.",
  },
  {
    metric: "Write volume",
    value: "~2,000 rows/day",
    detail:
      "Around 700k rows a year. One PostgreSQL instance with monthly partitions handles this for years.",
  },
  {
    metric: "Scaling to 10,000 employees",
    value: "No redesign",
    detail:
      "Add DIDs and telephony concurrency. The attendance service is stateless and scales horizontally behind the queue.",
  },
];

export const IVR_SCRIPT: Array<{ speaker: "agent" | "employee"; line: string; note?: string }> = [
  {
    speaker: "agent",
    line: "Good morning, this is the Gurgaon Hub attendance line. Please say your employee code.",
    note: "Site identified from the dialled number",
  },
  { speaker: "employee", line: "Employee zero zero four one two." },
  {
    speaker: "agent",
    line: "Thank you. Is this Priya Nair?",
    note: "Caller ID matched to an employee record",
  },
  {
    speaker: "employee",
    line: "Yes, this is Priya.",
    note: "Voiceprint matched — confidence 0.94",
  },
  { speaker: "agent", line: "Are you checking in or checking out?" },
  { speaker: "employee", line: "Checking in." },
  {
    speaker: "agent",
    line: "Recorded. You are checked in at Gurgaon Hub 1 at 9:04 am. Have a good shift.",
    note: "Attendance written · status present · 22 seconds elapsed",
  },
];
