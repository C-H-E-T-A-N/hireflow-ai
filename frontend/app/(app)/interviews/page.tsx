"use client";

import { Mic, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RecommendationBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { query } from "@/lib/api";
import { formatDateTime, formatRelativeTime, humanise } from "@/lib/utils";
import type { InterviewListItem, ListResponse } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export default function InterviewsPage() {
  const [status, setStatus] = React.useState("all");

  const path = `/interviews${query({ status: status === "all" ? undefined : status, limit: 100 })}`;
  const { data, error, isLoading, refresh } = useApi<ListResponse<InterviewListItem>>(path, {
    refreshInterval: 10000,
  });

  const live = (data?.items ?? []).filter(
    (item) => item.status === "in_progress" || item.status === "dialing",
  );

  return (
    <>
      <PageHeader
        title="AI Interviews"
        description="Configure a structured voice interview, run it, and get a scored evaluation against a rubric."
        actions={
          <Button variant="primary" asChild>
            <Link href="/interviews/new">
              <Plus />
              New interview
            </Link>
          </Button>
        }
      />

      {live.length > 0 ? (
        <Card className="mb-5 border-brand-soft-border bg-brand-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-brand-text">
                {live.length} interview{live.length === 1 ? "" : "s"} running right now
              </p>
              <p className="text-[12.5px] text-ink-secondary">
                Open the interview room to follow the conversation live.
              </p>
            </div>
            <Button variant="primary" size="sm" asChild>
              <Link href={`/interviews/${live[0].id}`}>Open live room</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <Select
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
          className="w-44"
        />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : data && data.items.length > 0 ? (
          <div className="divide-y divide-line">
            {data.items.map((interview) => (
              <Link
                key={interview.id}
                href={`/interviews/${interview.id}`}
                className="group flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <Avatar name={interview.candidate?.full_name ?? "Candidate"} size="md" />

                <div className="min-w-0 flex-[2]">
                  <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand-text">
                    {interview.candidate?.full_name ?? "Unassigned candidate"}
                  </p>
                  <p className="truncate text-[12px] text-ink-tertiary">{interview.title}</p>
                </div>

                <div className="hidden flex-1 md:block">
                  <Badge tone="outline">{humanise(interview.difficulty)}</Badge>
                  <p className="mt-1 text-[11.5px] text-ink-tertiary">
                    {interview.duration_minutes} min · {humanise(interview.interview_type)}
                  </p>
                </div>

                <div className="w-24 shrink-0">
                  {interview.overall_score !== null ? (
                    <span className="tabular text-[15px] font-semibold text-ink">
                      {Math.round(interview.overall_score)}
                      <span className="text-[11.5px] font-normal text-ink-tertiary">/100</span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-tertiary">—</span>
                  )}
                </div>

                <div className="hidden w-32 shrink-0 lg:block">
                  {interview.recommendation !== "pending" ? (
                    <RecommendationBadge recommendation={interview.recommendation} />
                  ) : null}
                </div>

                <div className="w-36 shrink-0 text-right">
                  <StatusBadge status={interview.status} />
                  <p className="mt-1 text-[11px] text-ink-tertiary">
                    {interview.scheduled_at
                      ? formatDateTime(interview.scheduled_at)
                      : formatRelativeTime(interview.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Mic />}
            title="No interviews yet"
            description="Create an AI interview to screen a candidate with a structured, scored conversation."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/interviews/new">
                  <Plus />
                  New interview
                </Link>
              </Button>
            }
          />
        )}
      </Card>
    </>
  );
}
