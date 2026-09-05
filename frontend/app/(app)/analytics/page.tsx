"use client";

import { BarChart3 } from "lucide-react";
import * as React from "react";

import { BarChart, DonutChart, FunnelChart, TimelineChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/primitives";
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import type { AnalyticsResponse } from "@/types/api";

const PERIODS = [
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const INTEREST_COLOURS: Record<string, string> = {
  Interested: "var(--positive)",
  "Maybe Later": "var(--warning)",
  "Not Interested": "var(--danger)",
  Unknown: "var(--border-strong)",
};

export default function AnalyticsPage() {
  const [days, setDays] = React.useState("30");
  const { data, error, isLoading, refresh } = useApi<AnalyticsResponse>(`/analytics?days=${days}`);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the funnel is performing: what you sourced, who answered, who was interested and who cleared the interview bar."
        actions={
          <Select
            value={days}
            onValueChange={setDays}
            options={PERIODS}
            ariaLabel="Reporting period"
            className="w-44"
          />
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={refresh} />
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)
              : data?.metrics.map((metric) => (
                  <Card key={metric.key} className="p-4">
                    <p className="text-[12.5px] text-ink-secondary">{metric.label}</p>
                    <p className="tabular mt-2 text-2xl font-semibold leading-none tracking-tight text-ink">
                      {metric.value}
                      {metric.unit === "percent" ? "%" : ""}
                    </p>
                  </Card>
                ))}
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Activity over time</CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  Candidates sourced, outreach calls placed and interviews created per day.
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-52" />
                ) : (
                  <TimelineChart
                    data={data?.activity_timeline ?? []}
                    series={[
                      { key: "sourced", label: "Sourced", color: "var(--brand)" },
                      { key: "outreach", label: "Outreach", color: "var(--info)" },
                      { key: "interviews", label: "Interviews", color: "var(--positive)" },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hiring funnel</CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  Conversion from sourced through to shortlisted.
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-52" />
                ) : data && data.funnel.some((stage) => stage.count > 0) ? (
                  <FunnelChart stages={data.funnel} />
                ) : (
                  <EmptyState
                    icon={<BarChart3 />}
                    title="No funnel data yet"
                    description="Source candidates and run outreach to populate the funnel."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Outreach outcomes</CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  How candidates responded on AI voice calls.
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-36" />
                ) : data && data.interest_split.length > 0 ? (
                  <DonutChart
                    segments={data.interest_split.map((item) => ({
                      label: item.label,
                      value: item.value,
                      color: INTEREST_COLOURS[item.label] ?? "var(--brand)",
                    }))}
                    centerValue={`${data.interest_rate}%`}
                    centerLabel="interested"
                  />
                ) : (
                  <EmptyState
                    title="No completed calls yet"
                    description="Outcomes appear once outreach calls finish."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interview score distribution</CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  Overall scores across completed AI interviews.
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-36" />
                ) : (
                  <BarChart
                    data={(data?.score_distribution ?? []).map((bucket) => ({
                      label: bucket.bucket,
                      value: bucket.count,
                    }))}
                    emptyLabel="No interviews have been scored yet."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
