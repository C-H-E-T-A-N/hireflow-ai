"use client";

import {
  ArrowLeft,
  CheckCircle2,
  FastForward,
  ListChecks,
  Mic,
  Phone,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  AgentIdentity,
  AgentStatus,
  AiPanel,
  DemoModeNotice,
  SpeechToggle,
  VoiceWaveform,
} from "@/components/ai/voice";
import { ScoreBar, ScoreRing } from "@/components/charts/charts";
import { Transcript } from "@/components/conversations/transcript";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RecommendationBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ErrorState, Skeleton, SkeletonText } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { useConversationSpeech, useVoicePlaybackPreference } from "@/hooks/use-speech";
import { api } from "@/lib/api";
import { cn, formatClock, formatDateTime, humanise } from "@/lib/utils";
import type { AgentState } from "@/components/ai/voice";
import type { InterviewDetail, InterviewLiveState, SystemStatus } from "@/types/api";

const ACTIVE_STATUSES = new Set(["dialing", "in_progress", "processing"]);

export default function InterviewPage() {
  const params = useParams<{ id: string }>();
  const interviewId = params.id;

  const {
    data: interview,
    error,
    isLoading,
    refresh,
  } = useApi<InterviewDetail>(`/interviews/${interviewId}`, { refreshInterval: 5000 });
  const { data: status } = useApi<SystemStatus>("/system/status");

  const isActive = interview ? ACTIVE_STATUSES.has(interview.status) : false;

  // The live endpoint advances the call state machine, so it is only polled
  // while a call is actually running.
  const { data: live } = useApi<InterviewLiveState>(`/interviews/${interviewId}/live`, {
    refreshInterval: 1500,
    enabled: isActive,
  });

  const [busy, setBusy] = React.useState(false);

  // The demo provider generates no audio, so the browser reads the transcript
  // aloud as it arrives. Keeps a simulated call feeling like a call.
  const speech = useVoicePlaybackPreference();
  const { supported: speechSupported, speakingIndex, blocked: speechBlocked, retry: retrySpeech } =
    useConversationSpeech({
    turns: live?.turns ?? [],
    mode: "live",
    enabled: speech.enabled && isActive,
  });

  const start = async () => {
    setBusy(true);
    try {
      await api.post(`/interviews/${interviewId}/start`);
      toast.success("Interview started.");
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not start the interview.");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await api.post(`/interviews/${interviewId}/complete`);
      toast.success("Interview completed and evaluated.");
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not complete the interview.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <InterviewSkeleton />;

  if (error || !interview) {
    return (
      <Card className="mt-8">
        <ErrorState
          title="Interview not found"
          message={error?.message ?? "This interview may have been removed."}
          onRetry={refresh}
        />
      </Card>
    );
  }

  // The live endpoint polls faster than the detail endpoint, so prefer its
  // status to keep the header badge in step with the transcript.
  const displayStatus = isActive && live ? live.status : interview.status;
  const agentState = toAgentState(displayStatus);
  const turns = live?.turns ?? [];
  const elapsed = live?.elapsed_seconds ?? 0;
  const progress =
    live && live.total_questions > 0
      ? Math.round(((live.current_question_index + 1) / live.total_questions) * 100)
      : 0;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/interviews">
          <ArrowLeft />
          Interviews
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={interview.candidate?.full_name ?? "Candidate"} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
              {interview.candidate?.full_name ?? "Candidate"}
            </h1>
            <p className="text-[13.5px] text-ink-secondary">{interview.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={displayStatus} />
              <Badge tone="outline">{humanise(interview.difficulty)}</Badge>
              <Badge tone="outline">{interview.duration_minutes} min</Badge>
              {interview.candidate ? (
                <Link
                  href={`/candidates/${interview.candidate_id}`}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-text hover:underline"
                >
                  <User className="size-3" />
                  Candidate profile
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {interview.status === "draft" || interview.status === "scheduled" ? (
            <Button variant="primary" onClick={start} loading={busy}>
              <Phone />
              Start interview
            </Button>
          ) : null}
          {isActive ? (
            <Button variant="secondary" onClick={complete} loading={busy}>
              <FastForward />
              Skip to result
            </Button>
          ) : null}
          {interview.status === "failed" ? (
            <Button variant="secondary" onClick={start} loading={busy}>
              <Phone />
              Retry call
            </Button>
          ) : null}
          {interview.conversation_id ? (
            <Button variant="secondary" asChild>
              <Link href={`/conversations/${interview.conversation_id}`}>Full conversation</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Pre-call */}
      {(interview.status === "draft" || interview.status === "scheduled") && status ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Question set</CardTitle>
              <p className="text-[13px] text-ink-secondary">
                Generated from your focus areas. Each question lists the signals a strong answer
                should contain — that rubric is what the evaluation scores against.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {interview.questions.map((question) => (
                  <li key={question.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-[11.5px] font-semibold text-ink-secondary">
                        {question.sequence + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] leading-relaxed text-ink">{question.prompt}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {question.focus_area ? (
                            <Badge tone="brand">{question.focus_area}</Badge>
                          ) : null}
                          {question.competency ? (
                            <Badge tone="outline">{question.competency}</Badge>
                          ) : null}
                          {question.expected_signals.slice(0, 4).map((signal) => (
                            <span
                              key={signal}
                              className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10.5px] text-ink-tertiary"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>AI interviewer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AgentIdentity
                  name={interview.agent_persona_name}
                  role="AI Interviewer"
                  state="ready"
                />
                <div className="rounded-lg border border-line bg-surface-muted p-3 text-[12.5px] leading-relaxed text-ink-secondary">
                  {interview.intro_message}
                </div>
                <DemoModeNotice mode={status.voice_mode} />
                <Button variant="primary" className="w-full" onClick={start} loading={busy}>
                  <Phone />
                  Start interview
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[13px]">
                <Row label="Role" value={interview.job?.title ?? "—"} />
                <Row label="Type" value={humanise(interview.interview_type)} />
                <Row label="Difficulty" value={humanise(interview.difficulty)} />
                <Row label="Duration" value={`${interview.duration_minutes} minutes`} />
                <Row label="Questions" value={String(interview.questions.length)} />
                <Row label="Language" value={humanise(interview.language)} />
                {interview.scheduled_at ? (
                  <Row label="Scheduled" value={formatDateTime(interview.scheduled_at)} />
                ) : null}
              </CardContent>
            </Card>

            {interview.focus_areas.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Focus areas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {interview.focus_areas.map((area) => (
                    <Badge key={area} tone="brand">
                      {area}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      ) : null}

      {/* Live room */}
      {isActive ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <div className="ai-gradient border-b border-brand-soft-border px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <AgentIdentity
                  name={interview.agent_persona_name}
                  role="AI Interviewer"
                  state={agentState}
                />
                <div className="flex items-center gap-3">
                  <SpeechToggle
                    enabled={speech.enabled}
                    onToggle={speechBlocked ? retrySpeech : speech.toggle}
                    supported={speechSupported}
                    blocked={speechBlocked}
                  />
                  <VoiceWaveform
                    active={displayStatus === "in_progress" && (speakingIndex !== null || !speech.enabled)}
                  />
                  <span className="tabular text-[15px] font-semibold text-ink">
                    {formatClock(elapsed)}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                  <span className="text-ink-secondary">
                    Question {Math.min((live?.current_question_index ?? 0) + 1, live?.total_questions ?? 0)}{" "}
                    of {live?.total_questions ?? interview.questions.length}
                  </span>
                  <span className="tabular text-ink-tertiary">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {live?.current_question ? (
                <div className="mt-4 rounded-xl border border-brand-soft-border bg-surface/70 p-3.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-text">
                    Currently asking
                  </p>
                  <p className="text-[13.5px] leading-relaxed text-ink">{live.current_question}</p>
                </div>
              ) : null}
            </div>

            <CardContent className="max-h-[560px] overflow-y-auto scrollbar-slim pt-5">
              <Transcript
                turns={turns}
                agentName={interview.agent_persona_name}
                candidateName={interview.candidate?.full_name ?? "Candidate"}
                live
                autoScroll
              />
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Call status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AgentStatus state={agentState} />
                <div className="space-y-2.5 text-[13px]">
                  <Row label="Provider" value={humanise(live?.provider ?? "demo")} />
                  <Row label="Call state" value={humanise(live?.call_status ?? "—")} />
                  <Row label="Elapsed" value={formatClock(elapsed)} />
                  <Row label="Turns captured" value={String(turns.length)} />
                </div>
                <Button variant="secondary" className="w-full" onClick={complete} loading={busy}>
                  <FastForward />
                  Skip to result
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Candidate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={interview.candidate?.full_name ?? "Candidate"} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {interview.candidate?.full_name}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-tertiary">
                      {interview.candidate?.current_title ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(interview.candidate?.skills ?? []).slice(0, 6).map((skill) => (
                    <Badge key={skill} tone="neutral">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      {/* Result */}
      {interview.status === "completed" ? (
        <CompletedInterview interview={interview} />
      ) : null}

      {interview.status === "failed" ? (
        <Card className="border-danger-soft">
          <CardContent className="flex items-start gap-3 pt-5">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-[14px] font-semibold text-ink">This interview did not complete</p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {interview.error_message ?? "The call could not be completed."}
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={start} loading={busy}>
                <Phone />
                Retry call
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function CompletedInterview({ interview }: { interview: InterviewDetail }) {
  const perCompetency = (interview.evaluation_detail?.per_competency ?? {}) as Record<
    string,
    number
  >;

  return (
    <div className="space-y-5">
      {/* Headline result */}
      <Card className="overflow-hidden">
        <div className="ai-gradient border-b border-brand-soft-border px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <ScoreRing score={interview.overall_score ?? 0} size={104} label="overall" />
              <div>
                <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-text">
                  <CheckCircle2 className="size-3.5" />
                  Interview complete
                </p>
                <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">
                  {interview.overall_score !== null
                    ? `${Math.round(interview.overall_score)}/100`
                    : "Not scored"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[12.5px] text-ink-secondary">AI recommendation</span>
                  <RecommendationBadge recommendation={interview.recommendation} />
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <ScoreBar label="Technical skills" score={interview.technical_score} />
              <ScoreBar label="Communication" score={interview.communication_score} />
              <ScoreBar label="Problem solving" score={interview.problem_solving_score} />
              <ScoreBar label="Role fit" score={interview.role_fit_score} />
            </div>
          </div>
        </div>

        {interview.evaluation_summary ? (
          <CardContent className="pt-5">
            <AiPanel title="AI evaluation">{interview.evaluation_summary}</AiPanel>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="answers">
          <TabsList className="mb-4">
            <TabsTrigger value="answers">Answers</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="answers">
            <Card>
              <CardHeader>
                <CardTitle>Question-by-question</CardTitle>
                <p className="text-[13px] text-ink-secondary">
                  Each answer is scored on how many of the question&apos;s expected signals it
                  actually covered.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {interview.questions.map((question) => {
                  const answer = question.answer;
                  const score = answer?.score ?? null;
                  return (
                    <div key={question.id} className="rounded-xl border border-line p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium leading-relaxed text-ink">
                            {question.prompt}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {question.focus_area ? (
                              <Badge tone="brand">{question.focus_area}</Badge>
                            ) : null}
                            {question.competency ? (
                              <Badge tone="outline">{question.competency}</Badge>
                            ) : null}
                          </div>
                        </div>
                        {score !== null ? (
                          <span
                            className={cn(
                              "tabular shrink-0 text-[15px] font-semibold",
                              score >= 75
                                ? "text-positive-text"
                                : score >= 50
                                  ? "text-warning-text"
                                  : "text-danger-text",
                            )}
                          >
                            {Math.round(score)}
                          </span>
                        ) : null}
                      </div>

                      {answer?.transcript ? (
                        <p className="mt-3 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] leading-relaxed text-ink-secondary">
                          {answer.transcript}
                        </p>
                      ) : (
                        <p className="mt-3 text-[12.5px] italic text-ink-tertiary">
                          No answer was captured for this question.
                        </p>
                      )}

                      {question.expected_signals.length > 0 ? (
                        <div className="mt-3">
                          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-tertiary">
                            Rubric signals
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {question.expected_signals.map((signal) => {
                              const detected = answer?.signals_detected.includes(signal);
                              return (
                                <span
                                  key={signal}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
                                    detected
                                      ? "border-positive-soft bg-positive-soft text-positive-text"
                                      : "border-dashed border-line-strong text-ink-tertiary",
                                  )}
                                >
                                  {detected ? <CheckCircle2 className="size-2.5" /> : null}
                                  {signal}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript">
            <Card>
              <CardContent className="pt-5">
                <InterviewTranscript interviewId={interview.id} interview={interview} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          {interview.strengths.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {interview.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] text-ink">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {interview.concerns.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Concerns</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {interview.concerns.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] text-ink">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {Object.keys(perCompetency).length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5">
                  <ListChecks className="size-4 text-ink-tertiary" />
                  By competency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(perCompetency).map(([competency, score]) => (
                  <ScoreBar key={competency} label={competency} score={score} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[13px]">
              <Row label="Provider" value={humanise(interview.voice_call?.provider ?? "demo")} />
              <Row
                label="Duration"
                value={
                  interview.voice_call?.duration_seconds
                    ? formatClock(interview.voice_call.duration_seconds)
                    : "—"
                }
              />
              <Row label="Completed" value={formatDateTime(interview.completed_at)} />
              <Row label="Questions" value={String(interview.questions.length)} />
              {interview.voice_call?.recording_url ? (
                <a
                  href={interview.voice_call.recording_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline"
                >
                  <Mic className="size-3.5" />
                  Listen to recording
                </a>
              ) : (
                <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-relaxed text-ink-tertiary">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  No audio recording: this conversation was simulated by the demo provider.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function InterviewTranscript({
  interviewId,
  interview,
}: {
  interviewId: string;
  interview: InterviewDetail;
}) {
  const { data, isLoading } = useApi<{ turns: InterviewLiveState["turns"] }>(
    `/interviews/${interviewId}/conversation`,
  );

  if (isLoading) return <SkeletonText lines={8} />;

  return (
    <Transcript
      turns={data?.turns ?? []}
      agentName={interview.agent_persona_name}
      candidateName={interview.candidate?.full_name ?? "Candidate"}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-tertiary">{label}</span>
      <span className="truncate font-medium text-ink">{value}</span>
    </div>
  );
}

function toAgentState(status: string): AgentState {
  if (status === "dialing") return "connecting";
  if (status === "in_progress") return "live";
  if (status === "processing") return "analyzing";
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  return "ready";
}

function InterviewSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-8 w-28" />
      <div className="mb-6 flex items-start gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <SkeletonText lines={10} />
        </Card>
        <Card className="p-5">
          <SkeletonText lines={6} />
        </Card>
      </div>
    </>
  );
}
