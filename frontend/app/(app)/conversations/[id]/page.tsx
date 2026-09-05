"use client";

import { ArrowLeft, Mic, PhoneOutgoing, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AiPanel, SpeechToggle } from "@/components/ai/voice";
import { ExtractedData, Transcript } from "@/components/conversations/transcript";
import { Avatar } from "@/components/ui/avatar";
import { Badge, SkillChip, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, Skeleton, SkeletonText } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { useConversationSpeech } from "@/hooks/use-speech";
import { formatClock, formatDateTime, humanise } from "@/lib/utils";
import type { Candidate, Conversation } from "@/types/api";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const { data, error, isLoading, refresh } = useApi<Conversation>(
    `/conversations/${conversationId}`,
  );
  const { data: candidate } = useApi<Candidate>(
    data?.candidate_id ? `/candidates/${data.candidate_id}` : null,
  );

  // Stored conversations have no audio (a demo call records none, and the Hunar
  // API returns a recording only for real calls), so offer to read the
  // transcript aloud in order.
  const [playing, setPlaying] = React.useState(false);
  const { supported: speechSupported, speakingIndex, blocked: speechBlocked, retry: retrySpeech } =
    useConversationSpeech({
    turns: data?.turns ?? [],
    mode: "playback",
    enabled: playing,
  });

  if (isLoading) return <ConversationSkeleton />;

  if (error || !data) {
    return (
      <Card className="mt-8">
        <ErrorState
          title="Conversation not found"
          message={error?.message ?? "This conversation may have been removed."}
          onRetry={refresh}
        />
      </Card>
    );
  }

  const isInterview = data.channel === "voice_interview";
  const agentName = isInterview ? "AI Interviewer" : "AI Recruiter";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/conversations">
          <ArrowLeft />
          Conversations
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={isInterview ? "brand" : "neutral"}>
              {isInterview ? <Mic className="size-3" /> : <PhoneOutgoing className="size-3" />}
              {isInterview ? "AI interview" : "AI outreach"}
            </Badge>
            <StatusBadge status={data.status} />
            {data.sentiment ? <Badge tone="outline">{humanise(data.sentiment)}</Badge> : null}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {data.title ?? "Conversation"}
          </h1>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            {formatDateTime(data.created_at)} · {data.turns.length} turns
            {data.voice_call?.duration_seconds
              ? ` · ${formatClock(data.voice_call.duration_seconds)}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: candidate */}
        <aside className="space-y-4 lg:order-1">
          {candidate ? (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <Avatar name={candidate.full_name} size="lg" />
                  <div className="min-w-0">
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="truncate text-[15px] font-semibold text-ink hover:text-brand-text"
                    >
                      {candidate.full_name}
                    </Link>
                    <p className="truncate text-[12.5px] text-ink-secondary">
                      {candidate.current_title ?? "—"}
                    </p>
                    <p className="truncate text-[12px] text-ink-tertiary">
                      {candidate.location ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {candidate.skills.slice(0, 8).map((skill) => (
                    <SkillChip key={skill}>{skill}</SkillChip>
                  ))}
                </div>

                <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
                  <Link href={`/candidates/${candidate.id}`}>Open full profile</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-5">
              <SkeletonText lines={4} />
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Structured answers</CardTitle>
              <p className="text-[12.5px] text-ink-tertiary">
                Extracted by the agent&apos;s result schema.
              </p>
            </CardHeader>
            <CardContent>
              <ExtractedData data={data.extracted_data} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[13px]">
              <Row label="Provider" value={humanise(data.voice_call?.provider ?? "demo")} />
              <Row label="Status" value={humanise(data.voice_call?.status ?? data.status)} />
              <Row
                label="Duration"
                value={
                  data.voice_call?.duration_seconds
                    ? formatClock(data.voice_call.duration_seconds)
                    : "—"
                }
              />
              <Row label="Answered by" value={humanise(data.voice_call?.answered_by ?? "—")} />
              {data.voice_call?.recording_url ? (
                <a
                  href={data.voice_call.recording_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[13px] font-medium text-brand-text hover:underline"
                >
                  Listen to recording
                </a>
              ) : (
                <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-relaxed text-ink-tertiary">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  No audio: this conversation was simulated by the demo provider.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Right: timeline */}
        <div className="min-w-0 lg:order-2">
          {data.summary ? <AiPanel className="mb-4">{data.summary}</AiPanel> : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Conversation</CardTitle>
              {(data.turns ?? []).length > 0 ? (
                <SpeechToggle
                  enabled={playing}
                  onToggle={speechBlocked ? retrySpeech : () => setPlaying((current) => !current)}
                  supported={speechSupported}
                  blocked={speechBlocked}
                  label={playing ? "Stop" : "Play conversation"}
                />
              ) : null}
            </CardHeader>
            <CardContent className="pt-3">
              <Transcript
                turns={data.turns}
                agentName={agentName}
                candidateName={candidate?.full_name ?? "Candidate"}
                speakingSequence={speakingIndex}
                emptyLabel="No transcript was captured for this conversation. The Hunar external API returns a structured result and a recording rather than a turn-by-turn transcript, so live calls may show extracted answers only."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
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

function ConversationSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-8 w-32" />
      <Skeleton className="mb-6 h-7 w-72" />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-5">
          <SkeletonText lines={6} />
        </Card>
        <Card className="p-5">
          <SkeletonText lines={12} />
        </Card>
      </div>
    </>
  );
}
