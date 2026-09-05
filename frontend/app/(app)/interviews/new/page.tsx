"use client";

import { ArrowLeft, Bot, Check, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AgentIdentity, DemoModeNotice } from "@/components/ai/voice";
import { PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { cn, humanise } from "@/lib/utils";
import type {
  CandidateListItem,
  InterviewDetail,
  JobStats,
  ListResponse,
  SystemStatus,
} from "@/types/api";

const DIFFICULTIES = [
  { value: "entry", label: "Entry", hint: "Fundamentals and day-to-day work" },
  { value: "intermediate", label: "Intermediate", hint: "Real problems, some depth" },
  { value: "advanced", label: "Advanced", hint: "Architecture and trade-offs" },
  { value: "expert", label: "Expert", hint: "Ambiguous, systems-level" },
];

const DURATIONS = [15, 20, 30, 45, 60];

const TYPES = [
  { value: "technical", label: "Technical" },
  { value: "screening", label: "Screening" },
  { value: "behavioural", label: "Behavioural" },
  { value: "culture_fit", label: "Culture fit" },
];

export default function NewInterviewPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <NewInterviewInner />
    </React.Suspense>
  );
}

function NewInterviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: jobs } = useApi<ListResponse<JobStats>>("/jobs");
  const { data: candidates } = useApi<ListResponse<CandidateListItem>>("/candidates?limit=100");
  const { data: status } = useApi<SystemStatus>("/system/status");

  // Selections are stored as "not chosen yet" (undefined / null) and the
  // defaults are derived from the loaded data during render, so nothing has to
  // be synchronised in an effect once the API responds.
  const [pickedJobId, setPickedJobId] = React.useState<string>();
  const [candidateId, setCandidateId] = React.useState<string | undefined>(
    searchParams.get("candidate") ?? undefined,
  );
  const [interviewType, setInterviewType] = React.useState("technical");
  const [difficulty, setDifficulty] = React.useState("intermediate");
  const [duration, setDuration] = React.useState(30);
  const [pickedFocusAreas, setPickedFocusAreas] = React.useState<string[] | null>(null);
  const [personaName, setPersonaName] = React.useState("Aria");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const availableFocus = React.useMemo(
    () => status?.available_focus_areas ?? [],
    [status],
  );

  const jobId = pickedJobId ?? jobs?.items[0]?.id;
  const selectedJob = jobs?.items.find((job) => job.id === jobId);
  const selectedCandidate = candidates?.items.find((item) => item.id === candidateId);

  // Until the recruiter touches the focus areas, suggest the job's own skills
  // that the question bank can actually generate questions for.
  const suggestedFocus = React.useMemo(() => {
    if (!selectedJob) return [];
    return selectedJob.required_skills
      .filter((skill) => availableFocus.includes(skill))
      .slice(0, 4);
  }, [selectedJob, availableFocus]);

  const focusAreas = pickedFocusAreas ?? suggestedFocus;

  const toggleFocus = (area: string) => {
    setPickedFocusAreas(
      focusAreas.includes(area)
        ? focusAreas.filter((item) => item !== area)
        : [...focusAreas, area],
    );
  };

  const canSubmit = Boolean(jobId && candidateId && focusAreas.length > 0);

  const submit = async (startNow: boolean) => {
    if (!canSubmit) {
      toast.error("Pick a job, a candidate and at least one focus area.");
      return;
    }
    setSubmitting(true);
    try {
      const interview = await api.post<InterviewDetail>("/interviews", {
        job_id: jobId,
        candidate_id: candidateId,
        interview_type: interviewType,
        difficulty,
        duration_minutes: duration,
        focus_areas: focusAreas,
        agent_persona_name: personaName.trim() || "Aria",
        notes: notes.trim() || undefined,
      });

      if (startNow) {
        await api.post(`/interviews/${interview.id}/start`);
        toast.success("Interview started. Opening the live room.");
      } else {
        toast.success("Interview configured.");
      }
      router.push(`/interviews/${interview.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the interview.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/interviews">
          <ArrowLeft />
          Interviews
        </Link>
      </Button>

      <PageHeader
        title="New AI interview"
        description="Configure the interview. HireFlow generates a question set from your focus areas and scores the answers against the signals each question expects."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Who is being interviewed</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Job" hint="Sets the context for the agent">
                <Select
                  value={jobId}
                  onValueChange={setPickedJobId}
                  placeholder="Select a job"
                  ariaLabel="Job"
                  options={(jobs?.items ?? []).map((job) => ({
                    value: job.id,
                    label: job.title,
                  }))}
                />
              </Field>
              <Field label="Candidate">
                <Select
                  value={candidateId}
                  onValueChange={setCandidateId}
                  placeholder="Select a candidate"
                  ariaLabel="Candidate"
                  options={(candidates?.items ?? []).map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.full_name}${candidate.current_title ? ` — ${candidate.current_title}` : ""}`,
                  }))}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Interview type">
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((type) => (
                    <OptionChip
                      key={type.value}
                      selected={interviewType === type.value}
                      onClick={() => setInterviewType(type.value)}
                    >
                      {type.label}
                    </OptionChip>
                  ))}
                </div>
              </Field>

              <Field
                label="Focus areas"
                hint={`${focusAreas.length} selected`}
              >
                <div className="flex flex-wrap gap-2">
                  {availableFocus.length === 0 ? (
                    <Skeleton className="h-8 w-64" />
                  ) : (
                    availableFocus.map((area) => (
                      <OptionChip
                        key={area}
                        selected={focusAreas.includes(area)}
                        onClick={() => toggleFocus(area)}
                      >
                        {focusAreas.includes(area) ? <Check className="size-3" /> : null}
                        {area}
                      </OptionChip>
                    ))
                  )}
                </div>
                <p className="mt-2 text-[12px] text-ink-tertiary">
                  Each focus area contributes rubric-backed questions. Areas outside this list have
                  no question bank yet and are skipped.
                </p>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Difficulty">
                  <div className="grid gap-1.5">
                    {DIFFICULTIES.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setDifficulty(level.value)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                          difficulty === level.value
                            ? "border-brand bg-brand-soft"
                            : "border-line bg-surface hover:border-line-strong",
                        )}
                      >
                        <span>
                          <span className="block text-[13px] font-medium text-ink">
                            {level.label}
                          </span>
                          <span className="block text-[11.5px] text-ink-tertiary">{level.hint}</span>
                        </span>
                        {difficulty === level.value ? (
                          <Check className="size-4 text-brand" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="space-y-4">
                  <Field label="Duration" hint={`${duration} minutes`}>
                    <div className="flex flex-wrap gap-2">
                      {DURATIONS.map((value) => (
                        <OptionChip
                          key={value}
                          selected={duration === value}
                          onClick={() => setDuration(value)}
                        >
                          {value}m
                        </OptionChip>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] text-ink-tertiary">
                      Roughly one question per five minutes.
                    </p>
                  </Field>

                  <Field label="AI interviewer name">
                    <Input
                      value={personaName}
                      onChange={(event) => setPersonaName(event.target.value)}
                      maxLength={40}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Notes for the recruiter" hint="Optional">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Anything the reviewing recruiter should know."
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Summary rail */}
        <aside className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle>Interview preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AgentIdentity
                name={personaName || "Aria"}
                role="AI Interviewer"
                state="ready"
              />

              {selectedCandidate ? (
                <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-3">
                  <Avatar name={selectedCandidate.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {selectedCandidate.full_name}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-tertiary">
                      {selectedCandidate.current_title ?? "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-ink-tertiary">
                  Select a candidate to preview
                </p>
              )}

              <dl className="space-y-2.5 text-[13px]">
                <SummaryRow label="Role" value={selectedJob?.title ?? "—"} />
                <SummaryRow label="Type" value={humanise(interviewType)} />
                <SummaryRow label="Difficulty" value={humanise(difficulty)} />
                <SummaryRow label="Duration" value={`${duration} minutes`} />
              </dl>

              {focusAreas.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                    Focus
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {focusAreas.map((area) => (
                      <Badge key={area} tone="brand">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {status ? <DemoModeNotice mode={status.voice_mode} /> : null}

              <div className="space-y-2 pt-1">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={!canSubmit}
                  loading={submitting}
                  onClick={() => submit(true)}
                >
                  <Mic />
                  Create & start interview
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!canSubmit || submitting}
                  onClick={() => submit(false)}
                >
                  <Sparkles />
                  Save without calling
                </Button>
              </div>

              <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-tertiary">
                <Bot className="mt-0.5 size-3 shrink-0" />
                Questions are generated when the interview is created, so you can review them before
                the call starts.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function OptionChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
        selected
          ? "border-brand bg-brand-soft text-brand-text"
          : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="truncate font-medium text-ink">{value}</dd>
    </div>
  );
}
