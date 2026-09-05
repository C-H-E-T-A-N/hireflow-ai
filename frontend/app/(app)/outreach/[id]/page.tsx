"use client";

import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FastForward,
  MapPin,
  Phone,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  AgentIdentity,
  AgentStatus,
  AiPanel,
  SpeechToggle,
  VoiceWaveform,
} from "@/components/ai/voice";
import { Transcript } from "@/components/conversations/transcript";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  InterestBadge,
  RecommendationBadge,
  SkillChip,
  StatusBadge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, Skeleton, SkeletonText } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { useConversationSpeech, useVoicePlaybackPreference } from "@/hooks/use-speech";
import { api } from "@/lib/api";
import { formatClock, formatDateTime, humanise } from "@/lib/utils";
import type { AgentState } from "@/components/ai/voice";
import type { OutreachDetail, OutreachLiveState } from "@/types/api";

const ACTIVE = new Set(["queued", "dialing", "in_progress", "processing"]);

export default function OutreachDetailPage() {
  const params = useParams<{ id: string }>();
  const outreachId = params.id;

  const { data: outreach, error, isLoading, refresh } = useApi<OutreachDetail>(
    `/outreach/${outreachId}`,
    { refreshInterval: 5000 },
  );

  const isActive = outreach ? ACTIVE.has(outreach.status) && outreach.status !== "queued" : false;

  const { data: live } = useApi<OutreachLiveState>(`/outreach/${outreachId}/live`, {
    refreshInterval: 1500,
    enabled: isActive,
  });

  const [busy, setBusy] = React.useState(false);

  // No audio exists for a simulated call, so read the transcript aloud instead.
  const speech = useVoicePlaybackPreference();
  const { supported: speechSupported, speakingIndex, blocked: speechBlocked, retry: retrySpeech } =
    useConversationSpeech({
    turns: live?.turns ?? [],
    mode: "live",
    enabled: speech.enabled && isActive,
  });

  const act = async (action: "start" | "complete") => {
    setBusy(true);
    try {
      await api.post(`/outreach/${outreachId}/${action}`);
      toast.success(action === "start" ? "Calling the candidate." : "Call completed and analysed.");
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <OutreachSkeleton />;

  if (error || !outreach) {
    return (
      <Card className="mt-8">
        <ErrorState
          title="Outreach not found"
          message={error?.message ?? "This outreach record may have been removed."}
          onRetry={refresh}
        />
      </Card>
    );
  }

  const displayStatus = isActive && live ? live.status : outreach.status;
  const agentState = toAgentState(displayStatus);
  const response = live?.response ?? outreach.response;
  const turns = live?.turns ?? [];
  const candidate = outreach.candidate;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/outreach">
          <ArrowLeft />
          AI Outreach
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={candidate?.full_name ?? "Candidate"} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
              {candidate?.full_name ?? "Candidate"}
            </h1>
            <p className="text-[13.5px] text-ink-secondary">
              {outreach.campaign_name ?? "AI outreach"} · {outreach.job?.title ?? "Role"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={displayStatus} />
              <Badge tone="outline">Agent {outreach.agent_persona_name}</Badge>
              {candidate ? (
                <Link
                  href={`/candidates/${outreach.candidate_id}`}
                  className="text-[12.5px] font-medium text-brand-text hover:underline"
                >
                  Candidate profile
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {outreach.status === "queued" ? (
            <Button variant="primary" onClick={() => act("start")} loading={busy}>
              <Phone />
              Place call
            </Button>
          ) : null}
          {isActive ? (
            <Button variant="secondary" onClick={() => act("complete")} loading={busy}>
              <FastForward />
              Skip to result
            </Button>
          ) : null}
          {(outreach.status === "failed" || outreach.status === "no_answer") ? (
            <Button variant="secondary" onClick={() => act("start")} loading={busy}>
              <Phone />
              Retry call
            </Button>
          ) : null}
          {outreach.conversation_id ? (
            <Button variant="secondary" asChild>
              <Link href={`/conversations/${outreach.conversation_id}`}>Full conversation</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Conversation */}
        <Card className="overflow-hidden">
          <div
            className={
              isActive
                ? "ai-gradient border-b border-brand-soft-border px-5 py-4"
                : "border-b border-line px-5 py-4"
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <AgentIdentity
                name={outreach.agent_persona_name}
                role="AI Recruiter"
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
                  {formatClock(live?.elapsed_seconds ?? outreach.voice_call?.duration_seconds ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="max-h-[620px] overflow-y-auto scrollbar-slim pt-5">
            {isActive || turns.length > 0 ? (
              <Transcript
                turns={turns}
                agentName={outreach.agent_persona_name}
                candidateName={candidate?.full_name ?? "Candidate"}
                live={isActive}
                autoScroll={isActive}
              />
            ) : (
              <StoredTranscript
                outreachId={outreachId}
                agentName={outreach.agent_persona_name}
                candidateName={candidate?.full_name ?? "Candidate"}
              />
            )}
          </CardContent>
        </Card>

        {/* Extracted answers */}
        <aside className="space-y-4">
          {outreach.status === "queued" ? (
            <Card>
              <CardContent className="pt-5">
                <AgentStatus state="ready" label="Queued — not yet dialled" />
                <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
                  This call is queued. Place it now to hear the AI recruiter qualify the candidate.
                </p>
                <Button
                  variant="primary"
                  className="mt-4 w-full"
                  onClick={() => act("start")}
                  loading={busy}
                >
                  <Phone />
                  Place call
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Structured answers</CardTitle>
              <p className="text-[12.5px] text-ink-tertiary">
                Extracted from the conversation using the agent&apos;s result schema.
              </p>
            </CardHeader>
            <CardContent>
              {response ? (
                <div className="space-y-3">
                  <Answer label="Interest">
                    <InterestBadge level={response.interest_level} />
                  </Answer>
                  <Answer label="Current role" icon={Briefcase}>
                    {response.current_role ?? "—"}
                    {response.current_company ? ` at ${response.current_company}` : ""}
                  </Answer>
                  <Answer label="Experience">
                    {response.experience_years ? `${response.experience_years} years` : "—"}
                  </Answer>
                  <Answer label="Location" icon={MapPin}>
                    {response.current_location ?? "—"}
                  </Answer>
                  <Answer label="Notice period" icon={CalendarClock}>
                    {response.notice_period_days ? `${response.notice_period_days} days` : "—"}
                  </Answer>
                  <Answer label="Expected compensation" icon={Wallet}>
                    {response.expected_compensation ?? "Not shared"}
                  </Answer>
                  <Answer label="Availability">{response.availability ?? "—"}</Answer>
                  <Answer label="Open to relocate">
                    {response.open_to_relocate === null
                      ? "—"
                      : response.open_to_relocate
                        ? "Yes"
                        : "No"}
                  </Answer>

                  {response.relevant_skills.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                        Relevant skills
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {response.relevant_skills.map((skill) => (
                          <SkillChip key={skill} matched>
                            {skill}
                          </SkillChip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : isActive ? (
                <div className="space-y-2.5">
                  <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
                    <span className="size-1.5 animate-pulse rounded-full bg-brand" />
                    Answers appear here as the AI extracts them.
                  </p>
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : (
                <p className="text-[13px] text-ink-tertiary">
                  No structured answers yet. They are extracted when the call completes.
                </p>
              )}
            </CardContent>
          </Card>

          {response?.ai_summary ? (
            <AiPanel title="AI summary">
              {response.ai_summary}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] text-ink-secondary">Recommendation</span>
                <RecommendationBadge recommendation={response.ai_recommendation} />
              </div>
            </AiPanel>
          ) : null}

          {response?.reason_for_interest ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Reason for interest</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-relaxed text-ink-secondary">
                  {response.reason_for_interest}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {outreach.talking_points.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Agent brief</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {outreach.talking_points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12.5px] text-ink-secondary">
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-ink-tertiary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[13px]">
              <Row label="Provider" value={humanise(outreach.voice_call?.provider ?? "demo")} />
              <Row label="Attempts" value={String(outreach.attempt_count)} />
              <Row label="Started" value={formatDateTime(outreach.started_at)} />
              <Row label="Completed" value={formatDateTime(outreach.completed_at)} />
              {outreach.error_message ? (
                <p className="flex items-start gap-1.5 pt-1 text-[12px] text-danger-text">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  {outreach.error_message}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function StoredTranscript({
  outreachId,
  agentName,
  candidateName,
}: {
  outreachId: string;
  agentName: string;
  candidateName: string;
}) {
  const { data, isLoading, error } = useApi<{ turns: OutreachLiveState["turns"] }>(
    `/outreach/${outreachId}/conversation`,
  );

  if (isLoading) return <SkeletonText lines={8} />;
  if (error) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-tertiary">
        No conversation has been recorded for this outreach yet.
      </p>
    );
  }

  return (
    <Transcript
      turns={data?.turns ?? []}
      agentName={agentName}
      candidateName={candidateName}
    />
  );
}

function Answer({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0">
      <span className="flex items-center gap-1.5 text-[12.5px] text-ink-tertiary">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </span>
      <span className="max-w-[60%] text-right text-[13px] font-medium text-ink">{children}</span>
    </div>
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
  if (status === "dialing" || status === "queued") return "connecting";
  if (status === "in_progress") return "live";
  if (status === "processing") return "analyzing";
  if (status === "completed") return "done";
  if (status === "failed" || status === "no_answer") return "failed";
  return "ready";
}

function OutreachSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-8 w-28" />
      <div className="mb-6 flex items-start gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <SkeletonText lines={10} />
        </Card>
        <Card className="p-5">
          <SkeletonText lines={8} />
        </Card>
      </div>
    </>
  );
}
