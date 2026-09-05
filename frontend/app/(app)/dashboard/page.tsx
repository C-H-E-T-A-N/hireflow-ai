"use client";

import { ArrowRight, CalendarClock, Plus, Radar, Sparkles } from "lucide-react";
import Link from "next/link";

import { DemoModeNotice } from "@/components/ai/voice";
import {
  ActivityFeed,
  InsightCard,
  MetricCard,
  PipelineBoard,
  RecentCandidatesTable,
  UpcomingInterviewRow,
} from "@/components/dashboard/widgets";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, SectionHeading } from "@/components/ui/card";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { greeting } from "@/lib/utils";
import type { DashboardResponse, SystemStatus } from "@/types/api";

export default function DashboardPage() {
  const { data, error, isLoading, refresh } = useApi<DashboardResponse>("/dashboard", {
    refreshInterval: 20000,
  });
  const { data: status } = useApi<SystemStatus>("/system/status");

  if (error) {
    return (
      <Card className="mt-10">
        <ErrorState
          title="Could not load your dashboard"
          message={error.message}
          onRetry={refresh}
        />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}, Chetan`}
        description="Here's what's happening with your hiring pipeline."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/people-search">
                <Radar />
                Source candidates
              </Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/interviews/new">
                <Plus />
                New AI interview
              </Link>
            </Button>
          </>
        }
      />

      {status?.voice_mode === "demo" ? <DemoModeNotice mode="demo" className="mb-6" /> : null}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
          : data?.metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
      </section>

      {/* Pipeline */}
      <section className="mt-9">
        <SectionHeading
          title="Hiring pipeline"
          description="Candidates by stage across every open role."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/candidates">
                View all
                <ArrowRight />
              </Link>
            </Button>
          }
        />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <PipelineBoard stages={data?.pipeline ?? []} />
        )}
      </section>

      <div className="mt-9 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent candidates */}
        {/* min-w-0: grid items default to min-width:auto, so the wide table inside
            would otherwise stretch the column and scroll the whole page. */}
        <section className="min-w-0">
          <SectionHeading
            title="Recent candidates"
            description="Most recently active people in your pipeline."
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/candidates">
                  All candidates
                  <ArrowRight />
                </Link>
              </Button>
            }
          />
          <Card className="overflow-hidden">
            {isLoading ? (
              <TableSkeleton rows={5} columns={4} />
            ) : data && data.recent_candidates.length > 0 ? (
              <RecentCandidatesTable candidates={data.recent_candidates} />
            ) : (
              <EmptyState
                title="No candidates yet"
                description="Paste a job description in People Search and HireFlow will find matching profiles for you."
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
        </section>

        {/* Right rail */}
        <div className="min-w-0 space-y-5">
          <section>
            <SectionHeading title="AI insights" description="What HireFlow noticed for you." />
            <div className="space-y-2.5">
              {isLoading ? (
                <>
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </>
              ) : data && data.insights.length > 0 ? (
                data.insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
              ) : (
                <Card>
                  <EmptyState
                    icon={<Sparkles />}
                    title="No insights yet"
                    description="Insights appear once candidates move through outreach and interviews."
                    className="py-10"
                  />
                </Card>
              )}
            </div>
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Upcoming interviews</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/interviews">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-1">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : data && data.upcoming_interviews.length > 0 ? (
                <div className="-mx-2">
                  {data.upcoming_interviews.map((interview) => (
                    <UpcomingInterviewRow key={interview.id} interview={interview} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarClock />}
                  title="Nothing scheduled"
                  description="Create an AI interview to see it here."
                  className="py-8"
                  action={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/interviews/new">Schedule one</Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-8" />
                  ))}
                </div>
              ) : data && data.activities.length > 0 ? (
                <ActivityFeed activities={data.activities} />
              ) : (
                <EmptyState title="No activity yet" className="py-8" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
