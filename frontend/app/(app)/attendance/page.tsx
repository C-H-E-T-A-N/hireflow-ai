"use client";

import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  Fingerprint,
  MapPin,
  Phone,
  ScrollText,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import * as React from "react";

import {
  ArchitectureDiagram,
  ArchitectureList,
} from "@/components/attendance/architecture";
import {
  FAILURE_SCENARIOS,
  FRAUD_CONTROLS,
  IVR_SCRIPT,
  SCALE_POINTS,
  STAGE_DETAILS,
} from "@/components/attendance/content";
import { DonutChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, SectionHeading } from "@/components/ui/card";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { cn, formatDateTime, humanise } from "@/lib/utils";
import type { AttendanceOverview } from "@/types/api";

const STATUS_TONES: Record<string, "positive" | "warning" | "danger" | "neutral"> = {
  present: "positive",
  late: "warning",
  pending_review: "danger",
  absent: "neutral",
};

export default function AttendancePage() {
  const [activeStage, setActiveStage] = React.useState<string>("agent");
  const { data, error, isLoading, refresh } = useApi<AttendanceOverview>("/attendance/overview");

  const detail = STAGE_DETAILS[activeStage];

  return (
    <>
      <PageHeader
        eyebrow={
          <Badge tone="brand">
            <Bot className="size-3" />
            System design · Assignment part 3
          </Badge>
        }
        title="Attendance without smartphones"
        description="A voice-first attendance infrastructure for 1,000 employees across 100 locations. No apps, no smartphones — just a phone call and a voice AI agent."
      />

      {/* Problem framing */}
      <Card className="mb-6 overflow-hidden">
        <div className="ai-gradient grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-text">
              The problem
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              If smartphones did not exist but LLMs did, how would HR track attendance for 1,000
              people every day across 100 locations? Biometric hardware at 100 sites is expensive to
              buy and worse to maintain. Paper registers are trivially falsified and arrive at
              payroll a week late. Supervisor headcounts turn attendance into a trust exercise.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink">
              <span className="font-semibold">The proposal:</span> every site gets a phone number.
              Employees call it, a voice AI agent verifies who they are and where they are, and the
              attendance service writes one auditable row. The interaction takes under 25 seconds
              and works on the cheapest handset made.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <HeroMetric
              label="Employees"
              value={data ? data.total_employees.toLocaleString() : "1,000"}
              icon={Users}
            />
            <HeroMetric
              label="Locations"
              value={data ? String(data.total_locations) : "100"}
              icon={Building2}
            />
            <HeroMetric
              label="Daily events"
              value={data ? data.marked_today.toLocaleString() : "~1,000"}
              icon={Activity}
            />
            <HeroMetric label="Hardware needed" value="None" icon={Phone} />
          </div>
        </div>
      </Card>

      {/* Employee workflow */}
      <section className="mb-8">
        <SectionHeading
          title="What the employee actually experiences"
          description="One call, three questions, under half a minute."
        />
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-3">
              {IVR_SCRIPT.map((line, index) => (
                <div key={index} className="flex gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                      line.speaker === "agent"
                        ? "border-brand-soft-border bg-brand-soft text-brand-text"
                        : "border-line bg-surface-muted text-ink-secondary",
                    )}
                  >
                    {line.speaker === "agent" ? (
                      <Bot className="size-3.5" />
                    ) : (
                      <Users className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[11.5px] font-semibold text-ink-tertiary">
                      {line.speaker === "agent" ? "Voice agent" : "Employee"}
                    </p>
                    <p
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink",
                        line.speaker === "agent"
                          ? "border-brand-soft-border bg-brand-soft/60"
                          : "border-line bg-surface-muted",
                      )}
                    >
                      {line.line}
                    </p>
                    {line.note ? (
                      <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-tertiary">
                        <CheckCircle2 className="size-3 text-positive" />
                        {line.note}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Architecture */}
      <section className="mb-8">
        <SectionHeading
          title="System architecture"
          description="Select any stage to see how it works and what it does when things go wrong."
        />
        <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardContent className="pt-5">
              <div className="hidden md:block">
                <ArchitectureDiagram activeId={activeStage} onSelect={setActiveStage} />
              </div>
              <div className="md:hidden">
                <ArchitectureList activeId={activeStage} onSelect={setActiveStage} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-20 lg:self-start">
            <CardHeader>
              <CardTitle className="text-[16px]">{detail.title}</CardTitle>
              <p className="text-[13.5px] leading-relaxed text-ink-secondary">{detail.summary}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5">
                {detail.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" />
                    {point}
                  </li>
                ))}
              </ul>

              {detail.failureMode ? (
                <div className="rounded-xl border border-warning-soft bg-warning-soft p-3.5">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-warning-text">
                    <TriangleAlert className="size-3.5" />
                    When it fails
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                    {detail.failureMode}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Verification, fraud, failure, scale */}
      <section className="mb-8">
        <Tabs defaultValue="fraud">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="fraud">Fraud prevention</TabsTrigger>
            <TabsTrigger value="failure">Failure handling</TabsTrigger>
            <TabsTrigger value="scale">Scalability</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="fraud">
            <div className="grid gap-3 md:grid-cols-2">
              {FRAUD_CONTROLS.map((item) => (
                <Card key={item.risk} className="p-4">
                  <p className="flex items-start gap-2 text-[13.5px] font-semibold text-ink">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                    {item.risk}
                  </p>
                  <p className="mt-2 pl-6 text-[13px] leading-relaxed text-ink-secondary">
                    {item.control}
                  </p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="failure">
            <Card>
              <CardContent className="pt-5">
                <ul className="divide-y divide-line">
                  {FAILURE_SCENARIOS.map((item) => (
                    <li key={item.scenario} className="grid gap-2 py-3.5 first:pt-0 last:pb-0 md:grid-cols-[280px_1fr] md:gap-6">
                      <p className="text-[13.5px] font-medium text-ink">{item.scenario}</p>
                      <p className="text-[13px] leading-relaxed text-ink-secondary">
                        {item.handling}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scale">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SCALE_POINTS.map((item) => (
                <Card key={item.metric} className="p-4">
                  <p className="text-[12.5px] text-ink-secondary">{item.metric}</p>
                  <p className="tabular mt-1.5 text-xl font-semibold leading-none text-ink">
                    {item.value}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-tertiary">
                    {item.detail}
                  </p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardContent className="space-y-3 pt-5">
                {[
                  "Voiceprints are stored as irreversible embeddings held by the verification vendor. Raw call audio is never retained for biometric purposes.",
                  "Enrolment is explicit and consented. An employee who declines voiceprint enrolment uses PIN verification with no penalty.",
                  "Call recordings, where retained at all, follow a short fixed retention window and are separated from the attendance record.",
                  "Attendance data is payroll data: access is role-scoped, and every read of an individual's history is itself audited.",
                  "Employees can request their own attendance history and dispute a record, which creates a new versioned row rather than editing history.",
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
                    <Fingerprint className="mt-0.5 size-4 shrink-0 text-brand" />
                    {item}
                  </p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Live HR dashboard */}
      <section className="mb-8">
        <SectionHeading
          title="HR dashboard"
          description="Backed by the real schema and seeded operational data — these figures come from live API queries, not mockups."
        />

        {error ? (
          <Card>
            <ErrorState message={error.message} onRetry={refresh} />
          </Card>
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Marked today" value={data.marked_today} sub={`of ${data.total_employees} employees`} />
              <StatCard label="Present" value={data.present} tone="positive" />
              <StatCard label="Late" value={data.late} tone="warning" />
              <StatCard label="Needs review" value={data.flagged} tone="danger" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
              <Card className="min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle>Recent check-ins</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto scrollbar-slim">
                    <table className="w-full min-w-[620px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                          <th className="py-2 pr-4 font-medium">Employee</th>
                          <th className="py-2 pr-4 font-medium">Location</th>
                          <th className="py-2 pr-4 font-medium">Check-in</th>
                          <th className="py-2 pr-4 font-medium">Verified by</th>
                          <th className="py-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.recent_events.map((event) => (
                          <tr key={event.id}>
                            <td className="py-2.5 pr-4">
                              <p className="text-[13px] font-medium text-ink">
                                {event.employee_name}
                              </p>
                              <p className="tabular text-[11px] text-ink-tertiary">
                                {event.employee_code}
                              </p>
                            </td>
                            <td className="py-2.5 pr-4 text-[12.5px] text-ink-secondary">
                              {event.location_name ?? "—"}
                            </td>
                            <td className="tabular py-2.5 pr-4 text-[12.5px] text-ink-secondary">
                              {event.check_in_at
                                ? new Date(event.check_in_at).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className="text-[12.5px] text-ink-secondary">
                                {humanise(event.verification_method)}
                              </span>
                              {event.voice_match_confidence !== null ? (
                                <span className="tabular ml-1.5 text-[11px] text-ink-tertiary">
                                  {event.voice_match_confidence.toFixed(2)}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge tone={STATUS_TONES[event.status] ?? "neutral"}>
                                {humanise(event.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Verification method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart
                      size={116}
                      segments={data.verification_split.map((item, index) => ({
                        label: item.label,
                        value: item.value,
                        color: [
                          "var(--brand)",
                          "var(--info)",
                          "var(--warning)",
                          "var(--border-strong)",
                        ][index % 4],
                      }))}
                      centerValue={data.marked_today}
                      centerLabel="today"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-ink-tertiary" />
                      Check-in rate by site
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.by_location.slice(0, 6).map((location) => (
                      <div key={location.location_id}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-[12.5px] text-ink">{location.name}</span>
                          <span className="tabular shrink-0 text-[12px] font-medium text-ink-secondary">
                            {location.marked}/{location.headcount}
                          </span>
                        </div>
                        <Progress
                          value={location.rate}
                          indicatorClassName={
                            location.rate >= 90
                              ? "bg-positive"
                              : location.rate >= 75
                                ? "bg-warning"
                                : "bg-danger"
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5">
                  <ScrollText className="size-4 text-ink-tertiary" />
                  Audit trail
                </CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  Append-only. Attendance drives payroll, so every write is reconstructable months
                  later.
                </p>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {data.audit_logs.map((log) => (
                    <li key={log.id} className="flex gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ink-tertiary" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-ink">
                          <span className="font-mono text-[12px] text-brand-text">
                            {log.action}
                          </span>{" "}
                          — {log.detail}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-ink-tertiary">
                          {log.actor} · {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>

      <Card className="border-dashed">
        <CardContent className="pt-5">
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            <span className="font-semibold text-ink">Scope note.</span> The telephony and IVR
            pipeline described here is a system design deliverable, not a shipped feature. What is
            real in this repository: the relational schema (
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11.5px]">
              locations
            </code>
            ,{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11.5px]">
              employees
            </code>
            ,{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11.5px]">
              attendance_events
            </code>
            ,{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11.5px]">
              audit_logs
            </code>
            ), the read APIs behind this dashboard, and a seeded dataset of 100 sites and 1,000
            employees. The voice layer would reuse the same Hunar agent and result-schema mechanism
            that already powers recruiting calls in this product.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function HeroMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-brand-soft-border bg-surface/70 p-3.5">
      <Icon className="size-4 text-brand" />
      <p className="tabular mt-2 text-xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11.5px] text-ink-tertiary">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "positive" | "warning" | "danger";
}) {
  const colour =
    tone === "positive"
      ? "text-positive-text"
      : tone === "warning"
        ? "text-warning-text"
        : tone === "danger"
          ? "text-danger-text"
          : "text-ink";

  return (
    <Card className="p-4">
      <p className="text-[12.5px] text-ink-secondary">{label}</p>
      <p className={cn("tabular mt-1.5 text-2xl font-semibold leading-none", colour)}>
        {value.toLocaleString()}
      </p>
      {sub ? <p className="mt-1.5 text-[11.5px] text-ink-tertiary">{sub}</p> : null}
    </Card>
  );
}
