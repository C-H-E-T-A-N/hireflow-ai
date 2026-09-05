"use client";

import { PhoneOutgoing, Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { VoiceWaveform } from "@/components/ai/voice";
import { PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { InterestBadge, RecommendationBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { query } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { ListResponse, OutreachDetail } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "no_answer", label: "No answer" },
  { value: "failed", label: "Failed" },
];

export default function OutreachPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState("all");

  const path = `/outreach${query({ status: status === "all" ? undefined : status, limit: 100 })}`;
  const { data, error, isLoading, refresh } = useApi<ListResponse<OutreachDetail>>(path, {
    refreshInterval: 8000,
  });

  const items = data?.items ?? [];
  const live = items.filter(
    (item) => item.status === "dialing" || item.status === "in_progress",
  );
  const completed = items.filter((item) => item.status === "completed");
  const interested = completed.filter(
    (item) => item.response?.interest_level === "interested",
  );

  return (
    <>
      <PageHeader
        title="AI Outreach"
        description="An AI recruiter calls your shortlist and returns structured answers: interest, current role, experience, location, notice period and compensation."
        actions={
          <Button variant="primary" asChild>
            <Link href="/people-search">
              <Radar />
              Source and call
            </Link>
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Total calls" value={items.length} />
        <Stat label="Completed" value={completed.length} />
        <Stat label="Interested" value={interested.length} tone="positive" />
        <Stat
          label="Connect rate"
          value={items.length ? `${Math.round((completed.length / items.length) * 100)}%` : "—"}
        />
      </div>

      {live.length > 0 ? (
        <Card className="mb-5 overflow-hidden border-brand-soft-border">
          <div className="ai-gradient flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <VoiceWaveform active />
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  {live.length} call{live.length === 1 ? "" : "s"} in progress
                </p>
                <p className="text-[12.5px] text-ink-secondary">
                  {live.map((item) => item.candidate?.full_name).filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm" asChild>
              <Link href={`/outreach/${live[0].id}`}>Listen in</Link>
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
          <TableSkeleton rows={6} columns={5} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : items.length > 0 ? (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                  <th className="px-5 py-2.5 font-medium">Candidate</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium">Interest</th>
                  <th className="px-5 py-2.5 font-medium">Notice</th>
                  <th className="px-5 py-2.5 font-medium">Expected</th>
                  <th className="px-5 py-2.5 font-medium">Recommendation</th>
                  <th className="px-5 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((outreach) => (
                  <tr
                    key={outreach.id}
                    className="group cursor-pointer transition-colors hover:bg-surface-muted"
                    onClick={() => router.push(`/outreach/${outreach.id}`)}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/outreach/${outreach.id}`}
                        className="flex items-center gap-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Avatar name={outreach.candidate?.full_name ?? "Candidate"} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand-text">
                            {outreach.candidate?.full_name ?? "—"}
                          </p>
                          <p className="truncate text-[12px] text-ink-tertiary">
                            {outreach.candidate?.current_title ?? "—"}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-secondary">
                      {outreach.job?.title ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {outreach.response ? (
                        <InterestBadge level={outreach.response.interest_level} />
                      ) : (
                        <span className="text-[13px] text-ink-tertiary">—</span>
                      )}
                    </td>
                    <td className="tabular px-5 py-3 text-[13px] text-ink-secondary">
                      {outreach.response?.notice_period_days
                        ? `${outreach.response.notice_period_days}d`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-secondary">
                      {outreach.response?.expected_compensation ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {outreach.response && outreach.response.ai_recommendation !== "pending" ? (
                        <RecommendationBadge recommendation={outreach.response.ai_recommendation} />
                      ) : (
                        <span className="text-[13px] text-ink-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge status={outreach.status} />
                      <p className="mt-1 text-[11px] text-ink-tertiary">
                        {formatRelativeTime(outreach.started_at ?? outreach.created_at)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<PhoneOutgoing />}
            title="No outreach calls yet"
            description="Source candidates for a role, select the promising ones, and let the AI recruiter qualify them in a single call each."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/people-search">
                  <Radar />
                  Source candidates
                </Link>
              </Button>
            }
          />
        )}
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "positive";
}) {
  return (
    <Card className="p-4">
      <p className="text-[12.5px] text-ink-secondary">{label}</p>
      <p
        className={
          tone === "positive"
            ? "tabular mt-1.5 text-2xl font-semibold leading-none text-positive-text"
            : "tabular mt-1.5 text-2xl font-semibold leading-none text-ink"
        }
      >
        {value}
      </p>
    </Card>
  );
}
