"use client";

import { ArrowLeft, MapPin, Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, Skeleton, SkeletonText } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { formatCurrencyRange, formatDate, humanise } from "@/lib/utils";
import type { Job, ParsedRequirements } from "@/types/api";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: job, error, isLoading, refresh } = useApi<Job>(`/jobs/${params.id}`);

  if (isLoading) {
    return (
      <>
        <Skeleton className="mb-4 h-8 w-24" />
        <Skeleton className="mb-6 h-8 w-72" />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-5">
            <SkeletonText lines={12} />
          </Card>
          <Card className="p-5">
            <SkeletonText lines={6} />
          </Card>
        </div>
      </>
    );
  }

  if (error || !job) {
    return (
      <Card className="mt-8">
        <ErrorState
          title="Job not found"
          message={error?.message ?? "This job may have been removed."}
          onRetry={refresh}
        />
      </Card>
    );
  }

  const parsed = job.parsed_requirements as ParsedRequirements;
  const hasParsed = parsed && "engine" in parsed;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/jobs">
          <ArrowLeft />
          Jobs
        </Link>
      </Button>

      <PageHeader
        title={job.title}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={job.status === "open" ? "positive" : "neutral"}>
              {humanise(job.status)}
            </Badge>
            {job.location ? (
              <span className="flex items-center gap-1 text-[12.5px] text-ink-tertiary">
                <MapPin className="size-3" />
                {job.location}
              </span>
            ) : null}
            {job.department ? (
              <span className="text-[12.5px] text-ink-tertiary">{job.department}</span>
            ) : null}
          </div>
        }
        actions={
          <Button variant="primary" asChild>
            <Link href="/people-search">
              <Radar />
              Source candidates
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Job description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-secondary">
              {job.description || "No description was provided for this role."}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand" />
                Parsed requirements
              </CardTitle>
              {hasParsed ? (
                <p className="text-[12px] text-ink-tertiary">
                  Extracted by the {parsed.engine} engine.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {job.required_skills.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                    Required skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.required_skills.map((skill) => (
                      <Badge key={skill} tone="brand">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-ink-tertiary">
                  No requirements were extracted from this description.
                </p>
              )}

              {job.nice_to_have_skills.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                    Nice to have
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.nice_to_have_skills.map((skill) => (
                      <Badge key={skill} tone="neutral">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2.5 border-t border-line pt-4 text-[13px]">
                <Row
                  label="Experience"
                  value={
                    job.min_experience_years
                      ? `${job.min_experience_years}${job.max_experience_years ? `–${job.max_experience_years}` : "+"} years`
                      : "Not specified"
                  }
                />
                <Row label="Seniority" value={job.seniority ?? "Not specified"} />
                <Row label="Employment" value={humanise(job.employment_type)} />
                <Row
                  label="Compensation"
                  value={
                    formatCurrencyRange(job.salary_min, job.salary_max, job.salary_currency) ??
                    "Not specified"
                  }
                />
                <Row label="Created" value={formatDate(job.created_at)} />
              </div>
            </CardContent>
          </Card>

          {hasParsed && parsed.responsibilities?.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Key responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {parsed.responsibilities.slice(0, 6).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12.5px] text-ink-secondary">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-tertiary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
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
