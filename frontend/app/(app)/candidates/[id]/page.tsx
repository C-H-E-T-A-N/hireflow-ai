"use client";

import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  MessagesSquare,
  Mic,
  Phone,
  PhoneOutgoing,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AiPanel } from "@/components/ai/voice";
import { StartOutreachDialog } from "@/components/outreach/start-outreach-dialog";
import { ScoreRing } from "@/components/charts/charts";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  InterestBadge,
  RecommendationBadge,
  SkillChip,
  StageBadge,
  StatusBadge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, ErrorState, Skeleton, SkeletonText } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatRelativeTime, humanise } from "@/lib/utils";
import type {
  Candidate,
  ConversationListItem,
  InterviewListItem,
  JobMatch,
  Outreach,
} from "@/types/api";

interface TimelineResponse {
  interviews: InterviewListItem[];
  outreaches: Outreach[];
  conversations: ConversationListItem[];
  matches: JobMatch[];
}

export default function CandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;

  const { data: candidate, error, isLoading, refresh } = useApi<Candidate>(
    `/candidates/${candidateId}`,
  );
  const { data: timeline } = useApi<TimelineResponse>(`/candidates/${candidateId}/timeline`);
  const [outreachOpen, setOutreachOpen] = React.useState(false);

  if (isLoading) return <ProfileSkeleton />;

  if (error || !candidate) {
    return (
      <Card className="mt-8">
        <ErrorState
          title="Candidate not found"
          message={error?.message ?? "This candidate may have been removed."}
          onRetry={refresh}
        />
      </Card>
    );
  }

  const bestMatch = timeline?.matches?.[0];
  const latestOutreach = timeline?.outreaches?.[0];
  const latestInterview = timeline?.interviews?.find((item) => item.status === "completed");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/candidates">
          <ArrowLeft />
          All candidates
        </Link>
      </Button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="ai-gradient h-20" aria-hidden />
        <div className="px-6 pb-5">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar
                name={candidate.full_name}
                src={candidate.avatar_url}
                size="xl"
                className="ring-4 ring-surface"
              />
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                  {candidate.full_name}
                </h1>
                <p className="truncate text-[13.5px] text-ink-secondary">
                  {candidate.current_title ?? "—"}
                  {candidate.current_company ? ` at ${candidate.current_company}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StageBadge stage={candidate.stage} />
                  {bestMatch ? (
                    <Badge tone="brand">
                      <Sparkles className="size-3" />
                      {Math.round(bestMatch.score)}% AI match
                    </Badge>
                  ) : null}
                  {candidate.source_provider ? (
                    <Badge tone="outline">via {candidate.source_provider}</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              <Button variant="secondary" asChild>
                <Link href={`/interviews/new?candidate=${candidate.id}`}>
                  <Mic />
                  Schedule interview
                </Link>
              </Button>
              <Button variant="primary" onClick={() => setOutreachOpen(true)}>
                <PhoneOutgoing />
                Start AI outreach
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="match">Job match</TabsTrigger>
              <TabsTrigger value="outreach">
                Outreach {timeline?.outreaches.length ? `(${timeline.outreaches.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="interviews">
                Interviews {timeline?.interviews.length ? `(${timeline.interviews.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              {candidate.summary ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[13.5px] leading-relaxed text-ink-secondary">
                      {candidate.summary}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  {candidate.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill) => (
                        <SkillChip
                          key={skill}
                          matched={bestMatch?.matched_skills.includes(skill)}
                        >
                          {skill}
                        </SkillChip>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-ink-tertiary">No skills recorded.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Experience</CardTitle>
                </CardHeader>
                <CardContent>
                  {candidate.experience.length > 0 ? (
                    <ol className="space-y-4">
                      {candidate.experience.map((role, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-tertiary">
                            <Building2 className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-ink">
                              {role.title ?? "Role"}
                            </p>
                            <p className="text-[12.5px] text-ink-secondary">{role.company ?? "—"}</p>
                            <p className="mt-0.5 text-[11.5px] text-ink-tertiary">
                              {role.start ?? "—"} — {role.end ?? "Present"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-[13px] text-ink-tertiary">No experience history available.</p>
                  )}
                </CardContent>
              </Card>

              {candidate.education.length > 0 ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Education</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {candidate.education.map((entry, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-tertiary">
                            <GraduationCap className="size-3.5" />
                          </span>
                          <div>
                            <p className="text-[13.5px] font-medium text-ink">
                              {entry.school ?? "—"}
                            </p>
                            <p className="text-[12.5px] text-ink-secondary">
                              {entry.degree ?? "—"}
                              {entry.year ? ` · ${entry.year}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="match" className="space-y-4">
              {timeline?.matches.length ? (
                timeline.matches.map((match) => (
                  <Card key={match.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start gap-5">
                        <ScoreRing score={match.score} label="fit" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/jobs/${match.job_id}`}
                            className="text-[14.5px] font-semibold text-ink hover:text-brand-text"
                          >
                            {match.job_title ?? "Role"}
                          </Link>
                          <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                            {match.rationale}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <ScoreBreakdown label="Skills" value={match.skill_score} />
                            <ScoreBreakdown label="Experience" value={match.experience_score} />
                            <ScoreBreakdown label="Location" value={match.location_score} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {match.matched_skills.map((skill) => (
                              <SkillChip key={skill} matched>
                                {skill}
                              </SkillChip>
                            ))}
                            {match.missing_skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[11.5px] text-ink-tertiary line-through"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <EmptyState
                    icon={<Target />}
                    title="No job matches yet"
                    description="Match scores are calculated when a candidate is sourced against a role."
                  />
                </Card>
              )}
            </TabsContent>

            <TabsContent value="outreach" className="space-y-4">
              {timeline?.outreaches.length ? (
                timeline.outreaches.map((outreach) => (
                  <Card key={outreach.id}>
                    <CardContent className="pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">
                            {outreach.campaign_name ?? "AI outreach call"}
                          </p>
                          <p className="text-[12px] text-ink-tertiary">
                            {formatDateTime(outreach.started_at ?? outreach.created_at)} · agent{" "}
                            {outreach.agent_persona_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={outreach.status} />
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/outreach/${outreach.id}`}>Open</Link>
                          </Button>
                        </div>
                      </div>

                      {outreach.response ? (
                        <>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Fact label="Interest">
                              <InterestBadge level={outreach.response.interest_level} />
                            </Fact>
                            <Fact label="Notice period">
                              {outreach.response.notice_period_days
                                ? `${outreach.response.notice_period_days} days`
                                : "—"}
                            </Fact>
                            <Fact label="Location">
                              {outreach.response.current_location ?? "—"}
                            </Fact>
                            <Fact label="Expected CTC">
                              {outreach.response.expected_compensation ?? "—"}
                            </Fact>
                          </div>
                          {outreach.response.ai_summary ? (
                            <AiPanel className="mt-4">
                              {outreach.response.ai_summary}
                              <div className="mt-2.5">
                                <RecommendationBadge
                                  recommendation={outreach.response.ai_recommendation}
                                />
                              </div>
                            </AiPanel>
                          ) : null}
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <EmptyState
                    icon={<PhoneOutgoing />}
                    title="No outreach yet"
                    description="Start an AI voice call to qualify this candidate in a single conversation."
                    action={
                      <Button variant="primary" size="sm" onClick={() => setOutreachOpen(true)}>
                        Start AI outreach
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>

            <TabsContent value="interviews" className="space-y-4">
              {timeline?.interviews.length ? (
                timeline.interviews.map((interview) => (
                  <Card key={interview.id} interactive>
                    <CardContent className="pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink">
                            {interview.title}
                          </p>
                          <p className="text-[12px] text-ink-tertiary">
                            {humanise(interview.difficulty)} · {interview.duration_minutes} min ·{" "}
                            {formatRelativeTime(interview.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {interview.overall_score !== null ? (
                            <span className="tabular text-[15px] font-semibold text-ink">
                              {Math.round(interview.overall_score)}
                              <span className="text-[12px] text-ink-tertiary">/100</span>
                            </span>
                          ) : null}
                          <StatusBadge status={interview.status} />
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/interviews/${interview.id}`}>Open</Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <EmptyState
                    icon={<Mic />}
                    title="No interviews yet"
                    description="Configure an AI interview with focus areas, difficulty and duration."
                    action={
                      <Button variant="primary" size="sm" asChild>
                        <Link href={`/interviews/new?candidate=${candidate.id}`}>
                          Schedule interview
                        </Link>
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {latestInterview?.overall_score ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Latest interview</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <ScoreRing score={latestInterview.overall_score} label="overall" />
                <div>
                  <RecommendationBadge recommendation={latestInterview.recommendation} />
                  <p className="mt-2 text-[12px] text-ink-tertiary">
                    {formatRelativeTime(latestInterview.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <Detail icon={MapPin} label="Location" value={candidate.location} />
              <Detail
                icon={CalendarClock}
                label="Availability"
                value={humanise(candidate.availability)}
              />
              {candidate.notice_period_days ? (
                <Detail
                  icon={CalendarClock}
                  label="Notice period"
                  value={`${candidate.notice_period_days} days`}
                />
              ) : null}
              {candidate.expected_ctc ? (
                <Detail icon={Target} label="Expected CTC" value={candidate.expected_ctc} />
              ) : null}
              <Detail
                icon={Building2}
                label="Experience"
                value={candidate.experience_years ? `${candidate.experience_years} years` : null}
              />
              <Detail icon={Mail} label="Email" value={candidate.email} />
              <Detail icon={Phone} label="Phone" value={candidate.phone} />
              {candidate.linkedin_url ? (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-[13px] font-medium text-brand-text hover:underline"
                >
                  <Linkedin className="size-3.5" />
                  LinkedIn profile
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
              {candidate.github_url ? (
                <a
                  href={candidate.github_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-[13px] font-medium text-brand-text hover:underline"
                >
                  <Github className="size-3.5" />
                  GitHub
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {timeline?.conversations.length ? (
                <div className="-mx-2 space-y-0.5">
                  {timeline.conversations.map((conversation) => (
                    <Link
                      key={conversation.id}
                      href={`/conversations/${conversation.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-tertiary">
                        {conversation.channel === "voice_interview" ? (
                          <Mic className="size-3.5" />
                        ) : (
                          <PhoneOutgoing className="size-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {conversation.channel === "voice_interview"
                            ? "AI interview"
                            : "AI outreach"}
                        </p>
                        <p className="text-[11px] text-ink-tertiary">
                          {conversation.turn_count} turns ·{" "}
                          {formatRelativeTime(conversation.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MessagesSquare />}
                  title="No conversations"
                  description="Voice calls appear here once they complete."
                  className="py-7"
                />
              )}
            </CardContent>
          </Card>

          {latestOutreach?.response?.reason_for_interest ? (
            <AiPanel title="Why they might move">
              {latestOutreach.response.reason_for_interest}
            </AiPanel>
          ) : null}
        </aside>
      </div>

      <StartOutreachDialog
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        candidateIds={[candidate.id]}
        candidateLabel={candidate.full_name}
        defaultJobId={bestMatch?.job_id}
      />
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">{label}</p>
      <div className="mt-1 text-[13px] font-medium text-ink">{children}</div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-tertiary" />
      <div className="min-w-0">
        <p className="text-[11.5px] text-ink-tertiary">{label}</p>
        <p className="truncate text-[13px] text-ink">{value || "—"}</p>
      </div>
    </div>
  );
}

function ScoreBreakdown({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-ink-secondary">{label}</span>
        <span className="tabular text-[12px] font-semibold text-ink">{Math.round(value)}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-8 w-32" />
      <Card className="overflow-hidden">
        <Skeleton className="h-20 rounded-none" />
        <div className="px-6 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex-1 pb-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          </div>
        </div>
      </Card>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <SkeletonText lines={6} />
        </Card>
        <Card className="p-5">
          <SkeletonText lines={5} />
        </Card>
      </div>
    </>
  );
}
