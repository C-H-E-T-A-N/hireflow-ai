"use client";

import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Lightbulb,
  Mic,
  PhoneOutgoing,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StageBadge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { DashboardResponse, MetricCard as MetricCardType, PipelineStage } from "@/types/api";

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active_jobs: Briefcase,
  candidates: Users,
  interviews: Mic,
  interested: CheckCircle2,
};

export function MetricCard({ metric }: { metric: MetricCardType }) {
  const Icon = METRIC_ICONS[metric.key] ?? TrendingUp;
  const suffix = metric.unit === "percent" ? "%" : "";

  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:border-line-strong hover:shadow-sm">
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: "var(--brand)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-ink-secondary">{metric.label}</p>
        <Icon className="size-4 text-ink-tertiary transition-colors group-hover:text-brand" />
      </div>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink">
        {metric.value}
        {suffix}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px]">
        {metric.delta ? (
          <span className="inline-flex items-center gap-0.5 font-medium text-positive-text">
            <ArrowUpRight className="size-3" />+{metric.delta}
          </span>
        ) : null}
        {metric.hint ? <span className="text-ink-tertiary">{metric.hint}</span> : null}
      </div>
    </Card>
  );
}

const PIPELINE_COLOURS = [
  "oklch(0.72 0.09 268)",
  "oklch(0.66 0.13 258)",
  "oklch(0.62 0.16 275)",
  "oklch(0.56 0.19 281)",
  "oklch(0.52 0.2 287)",
  "oklch(0.58 0.14 162)",
  "oklch(0.5 0.15 158)",
];

export function PipelineBoard({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  const total = stages[0]?.count || 1;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {stages.map((stage, index) => {
        const share = Math.round((stage.count / total) * 100);
        return (
          <Link
            key={stage.stage}
            href={`/candidates?stage=${stage.stage}`}
            className="group rounded-xl border border-line bg-surface p-3.5 transition-all duration-200 hover:border-line-strong hover:shadow-sm"
          >
            <p className="truncate text-[12px] font-medium text-ink-secondary">{stage.label}</p>
            <p className="tabular mt-1.5 text-xl font-semibold leading-none text-ink">
              {stage.count}
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max((stage.count / max) * 100, stage.count > 0 ? 6 : 0)}%`,
                  backgroundColor: PIPELINE_COLOURS[index % PIPELINE_COLOURS.length],
                }}
              />
            </div>
            <p className="tabular mt-1.5 text-[11px] text-ink-tertiary">
              {index === 0 ? "of pipeline" : `${share}% of sourced`}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

export function RecentCandidatesTable({
  candidates,
}: {
  candidates: DashboardResponse["recent_candidates"];
}) {
  return (
    <div className="overflow-x-auto scrollbar-slim">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-tertiary">
            <th className="px-5 py-2.5 font-medium">Candidate</th>
            <th className="px-5 py-2.5 font-medium">Role</th>
            <th className="px-5 py-2.5 font-medium">Match</th>
            <th className="px-5 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 text-right font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {candidates.map((candidate) => (
            <tr key={candidate.id} className="group transition-colors hover:bg-surface-muted">
              <td className="px-5 py-3">
                <Link href={`/candidates/${candidate.id}`} className="flex items-center gap-3">
                  <Avatar name={candidate.full_name} src={candidate.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand-text">
                      {candidate.full_name}
                    </p>
                    <p className="truncate text-[12px] text-ink-tertiary">
                      {candidate.current_title ?? "—"}
                    </p>
                  </div>
                </Link>
              </td>
              <td className="px-5 py-3 text-[13px] text-ink-secondary">
                <span className="line-clamp-1">{candidate.role ?? "—"}</span>
              </td>
              <td className="px-5 py-3">
                <MatchScore score={candidate.match_score} />
              </td>
              <td className="px-5 py-3">
                <StageBadge stage={candidate.stage} />
              </td>
              <td className="px-5 py-3 text-right text-[12.5px] text-ink-tertiary">
                {formatRelativeTime(candidate.last_activity_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchScore({ score, className }: { score: number | null; className?: string }) {
  if (score === null || score === undefined) {
    return <span className={cn("text-[13px] text-ink-tertiary", className)}>—</span>;
  }

  const rounded = Math.round(score);
  const tone =
    rounded >= 80
      ? "text-positive-text"
      : rounded >= 60
        ? "text-brand-text"
        : rounded >= 45
          ? "text-warning-text"
          : "text-ink-secondary";
  const bar =
    rounded >= 80
      ? "bg-positive"
      : rounded >= 60
        ? "bg-brand"
        : rounded >= 45
          ? "bg-warning"
          : "bg-ink-tertiary";

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-sunken">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-700", bar)}
          style={{ width: `${rounded}%` }}
        />
      </span>
      <span className={cn("tabular text-[13px] font-semibold", tone)}>{rounded}%</span>
    </span>
  );
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  job_created: Briefcase,
  candidate_sourced: UserPlus,
  candidate_stage_changed: Users,
  outreach_started: PhoneOutgoing,
  outreach_completed: CheckCircle2,
  interview_created: CalendarClock,
  interview_started: Mic,
  interview_completed: CheckCircle2,
  insight_generated: Sparkles,
};

export function ActivityFeed({ activities }: { activities: DashboardResponse["activities"] }) {
  return (
    <ol className="relative space-y-0.5">
      {activities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.type] ?? Sparkles;
        const isLast = index === activities.length - 1;
        return (
          <li key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[13px] top-7 h-full w-px bg-line" aria-hidden />
            ) : null}
            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-tertiary">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-ink">{activity.message}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-tertiary">
                {activity.actor} · {formatRelativeTime(activity.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const INSIGHT_TONES = {
  positive: "border-positive-soft bg-positive-soft",
  info: "border-brand-soft-border bg-brand-soft",
  warning: "border-warning-soft bg-warning-soft",
  critical: "border-danger-soft bg-danger-soft",
} as const;

export function InsightCard({ insight }: { insight: DashboardResponse["insights"][number] }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-transform duration-200 hover:-translate-y-0.5",
        INSIGHT_TONES[insight.severity] ?? INSIGHT_TONES.info,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-secondary" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-ink">{insight.title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">{insight.body}</p>
          {insight.action_label && insight.action_href ? (
            <Link
              href={insight.action_href}
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-text hover:underline"
            >
              {insight.action_label}
              <ArrowUpRight className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function UpcomingInterviewRow({
  interview,
}: {
  interview: DashboardResponse["upcoming_interviews"][number];
}) {
  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-muted"
    >
      <Avatar name={interview.candidate_name ?? "Candidate"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {interview.candidate_name ?? "Unassigned"}
        </p>
        <p className="truncate text-[11.5px] text-ink-tertiary">
          {interview.job_title ?? interview.title} · {interview.duration_minutes}m
        </p>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge status={interview.status} />
        <p className="mt-1 text-[11px] text-ink-tertiary">
          {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : "Not scheduled"}
        </p>
      </div>
    </Link>
  );
}

export function TrendBadge({ value }: { value: number }) {
  return (
    <Badge tone={value >= 0 ? "positive" : "danger"}>
      <TrendingUp className={cn("size-3", value < 0 && "rotate-180")} />
      {value >= 0 ? "+" : ""}
      {value}%
    </Badge>
  );
}
