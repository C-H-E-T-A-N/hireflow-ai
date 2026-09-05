"use client";

import { Search, SlidersHorizontal, Users, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { CandidateRow } from "@/components/candidates/candidate-card";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { query } from "@/lib/api";
import type { CandidateListItem, ListResponse } from "@/types/api";

const STAGE_OPTIONS = [
  { value: "all", label: "All stages" },
  { value: "sourced", label: "Sourced" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "interview_scheduled", label: "Interview scheduled" },
  { value: "interview_completed", label: "Interviewed" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "match", label: "Best match" },
  { value: "experience", label: "Most experience" },
  { value: "name", label: "Name (A–Z)" },
];

const EXPERIENCE_OPTIONS = [
  { value: "any", label: "Any experience" },
  { value: "2", label: "2+ years" },
  { value: "4", label: "4+ years" },
  { value: "6", label: "6+ years" },
  { value: "8", label: "8+ years" },
];

export default function CandidatesPage() {
  return (
    <React.Suspense fallback={<TableSkeleton />}>
      <CandidatesInner />
    </React.Suspense>
  );
}

function CandidatesInner() {
  const searchParams = useSearchParams();
  const initialStage = searchParams.get("stage") ?? "all";

  const [stage, setStage] = React.useState(initialStage);
  const [sort, setSort] = React.useState("recent");
  const [minExperience, setMinExperience] = React.useState("any");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const path = `/candidates${query({
    stage: stage === "all" ? undefined : stage,
    sort,
    q: debounced || undefined,
    min_experience: minExperience === "any" ? undefined : minExperience,
    limit: 100,
  })}`;

  const { data, error, isLoading, refresh } = useApi<ListResponse<CandidateListItem>>(path);

  const hasFilters = stage !== "all" || minExperience !== "any" || debounced.length > 0;

  const clearFilters = () => {
    setStage("all");
    setMinExperience("any");
    setSearch("");
  };

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Everyone in your pipeline, with an explainable match score against the roles they were sourced for."
        actions={
          <Button variant="primary" asChild>
            <Link href="/people-search">Source more candidates</Link>
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-tertiary" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, title or company"
            className="pl-9"
            aria-label="Search candidates"
          />
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Select
            value={stage}
            onValueChange={setStage}
            options={STAGE_OPTIONS}
            ariaLabel="Filter by stage"
            className="w-44"
          />
          <Select
            value={minExperience}
            onValueChange={setMinExperience}
            options={EXPERIENCE_OPTIONS}
            ariaLabel="Filter by experience"
            className="w-40"
          />
          <Select
            value={sort}
            onValueChange={setSort}
            options={SORT_OPTIONS}
            ariaLabel="Sort candidates"
            className="w-40"
          />
        </div>

        <Button
          variant="secondary"
          size="md"
          className="sm:hidden"
          onClick={() => setShowFilters((open) => !open)}
        >
          <SlidersHorizontal />
          Filters
        </Button>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            Clear
          </Button>
        ) : null}
      </div>

      {showFilters ? (
        <div className="mb-4 grid gap-2 sm:hidden">
          <Select value={stage} onValueChange={setStage} options={STAGE_OPTIONS} ariaLabel="Stage" />
          <Select
            value={minExperience}
            onValueChange={setMinExperience}
            options={EXPERIENCE_OPTIONS}
            ariaLabel="Experience"
          />
          <Select value={sort} onValueChange={setSort} options={SORT_OPTIONS} ariaLabel="Sort" />
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={7} columns={4} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <p className="text-[12px] text-ink-tertiary">
                {data.total} candidate{data.total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="divide-y divide-line">
              {data.items.map((candidate) => (
                <CandidateRow key={candidate.id} candidate={candidate} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Users />}
            title={hasFilters ? "No candidates match these filters" : "No candidates yet"}
            description={
              hasFilters
                ? "Try widening the stage or experience filter."
                : "Paste a job description in People Search and HireFlow will find matching profiles."
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" size="sm" asChild>
                  <Link href="/people-search">Source candidates</Link>
                </Button>
              )
            }
          />
        )}
      </Card>
    </>
  );
}
