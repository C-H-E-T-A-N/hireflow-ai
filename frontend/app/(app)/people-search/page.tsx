"use client";

import {
  Bookmark,
  Info,
  MapPin,
  PhoneOutgoing,
  Radar,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SourcedProfileCard } from "@/components/candidates/candidate-card";
import { StartOutreachDialog } from "@/components/outreach/start-outreach-dialog";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  CandidateListItem,
  JobStats,
  ListResponse,
  ParsedRequirements,
  PeopleSearchResponse,
  SystemStatus,
} from "@/types/api";

const SAMPLE_JD = `Senior Full Stack Developer — Gurgaon, Delhi NCR

We are hiring a Senior Full Stack Developer to own features end to end.

What you will do:
- Build customer-facing features using React, TypeScript and Node.js
- Design and evolve REST APIs consumed by web and mobile clients
- Model data in MongoDB and keep queries fast as the dataset grows

What we are looking for:
- 4+ years of professional experience building web applications
- Strong React and Node.js fundamentals with production TypeScript
- Comfortable designing REST APIs and working with MongoDB

Nice to have:
- Exposure to AWS and Docker`;

const SORT_OPTIONS = [
  { value: "match", label: "Best match" },
  { value: "experience", label: "Most experience" },
  { value: "name", label: "Name (A–Z)" },
];

export default function PeopleSearchPage() {
  const { data: status } = useApi<SystemStatus>("/system/status");
  const { data: jobs } = useApi<ListResponse<JobStats>>("/jobs");

  const [description, setDescription] = React.useState("");
  const [jobId, setJobId] = React.useState<string>("adhoc");
  const [parsed, setParsed] = React.useState<ParsedRequirements | null>(null);
  const [results, setResults] = React.useState<PeopleSearchResponse | null>(null);

  const [analysing, setAnalysing] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [outreachOpen, setOutreachOpen] = React.useState(false);
  const [outreachIds, setOutreachIds] = React.useState<string[]>([]);

  // Filters applied to the returned result set.
  const [minScore, setMinScore] = React.useState(0);
  const [locationFilter, setLocationFilter] = React.useState("");
  const [sort, setSort] = React.useState("match");

  const selectedJob = jobs?.items.find((job) => job.id === jobId);

  const analyse = async () => {
    if (description.trim().length < 30) {
      toast.error("Paste a longer job description so the parser has something to work with.");
      return;
    }
    setAnalysing(true);
    setError(null);
    try {
      const requirements = await api.post<ParsedRequirements>("/jobs/parse-description", {
        description,
      });
      setParsed(requirements);
      toast.success(
        `Extracted ${requirements.required_skills.length} required skills using the ${requirements.engine} engine.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not analyse the description.");
    } finally {
      setAnalysing(false);
    }
  };

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const payload =
        jobId !== "adhoc"
          ? { job_id: jobId, limit: 24 }
          : { description: description.trim() || undefined, limit: 24 };

      const response = await api.post<PeopleSearchResponse>("/search/candidates", payload);
      setResults(response);
      if (response.parsed_requirements) setParsed(response.parsed_requirements);
      setSelected(new Set());
      if (response.results.length === 0) {
        toast.message("No profiles matched", {
          description: "Try relaxing the experience or location requirements.",
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The search could not be completed.");
    } finally {
      setSearching(false);
    }
  };

  const visible = React.useMemo(() => {
    if (!results) return [];
    let items = results.results.filter(
      (profile) => (profile.match?.score ?? 0) >= minScore,
    );
    if (locationFilter.trim()) {
      const needle = locationFilter.trim().toLowerCase();
      items = items.filter((profile) => profile.location?.toLowerCase().includes(needle));
    }
    const sorted = [...items];
    if (sort === "experience") {
      sorted.sort((a, b) => (b.experience_years ?? 0) - (a.experience_years ?? 0));
    } else if (sort === "name") {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else {
      sorted.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
    }
    return sorted;
  }, [results, minScore, locationFilter, sort]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const saveSelected = async (): Promise<CandidateListItem[]> => {
    const profiles = (results?.results ?? []).filter((profile) =>
      selected.has(profile.provider_profile_id),
    );
    if (profiles.length === 0) return [];

    const saved = await api.post<ListResponse<CandidateListItem>>("/search/save", {
      job_id: jobId !== "adhoc" ? jobId : undefined,
      profiles,
    });
    return saved.items;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSelected();
      toast.success(`${saved.length} candidate${saved.length === 1 ? "" : "s"} added to your pool.`);
      // Mark them as saved so the cards switch to "View profile".
      setResults((current) =>
        current
          ? {
              ...current,
              results: current.results.map((profile) => {
                const match = saved.find((item) => item.full_name === profile.full_name);
                return match ? { ...profile, candidate_id: match.id } : profile;
              }),
            }
          : current,
      );
      setSelected(new Set());
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the candidates.");
    } finally {
      setSaving(false);
    }
  };

  const handleOutreach = async () => {
    if (jobId === "adhoc") {
      toast.error("Pick a job before starting outreach so the agent knows what to pitch.");
      return;
    }
    setSaving(true);
    try {
      // Candidates must exist in the pool before they can be called.
      const saved = await saveSelected();
      const ids = saved.map((item) => item.id);
      if (ids.length === 0) {
        toast.error("Select at least one candidate.");
        return;
      }
      setOutreachIds(ids);
      setOutreachOpen(true);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not prepare the outreach.");
    } finally {
      setSaving(false);
    }
  };

  const jobOptions = [
    { value: "adhoc", label: "Ad-hoc search (from pasted JD)" },
    ...(jobs?.items ?? []).map((job) => ({ value: job.id, label: job.title })),
  ];

  return (
    <>
      <PageHeader
        title="Find your next great hire"
        description="Paste a job description. HireFlow extracts the real requirements, searches your people-search provider and ranks every profile with an explainable match score."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Search composer */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Job description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Search against" hint="An existing role reuses its parsed requirements">
                <Select
                  value={jobId}
                  onValueChange={setJobId}
                  options={jobOptions}
                  ariaLabel="Search against"
                />
              </Field>

              {jobId === "adhoc" ? (
                <Field label="Paste the description">
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={10}
                    placeholder="Paste the full job description here…"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={analyse}
                      loading={analysing}
                      disabled={description.trim().length < 30}
                    >
                      <Wand2 />
                      Analyse JD
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDescription(SAMPLE_JD)}
                      disabled={analysing}
                    >
                      Use a sample
                    </Button>
                  </div>
                </Field>
              ) : (
                <div className="rounded-lg border border-line bg-surface-muted p-3.5">
                  <p className="text-[13px] font-medium text-ink">{selectedJob?.title}</p>
                  <p className="mt-0.5 text-[12px] text-ink-tertiary">
                    {selectedJob?.location ?? "Location not set"} ·{" "}
                    {selectedJob?.required_skills.length ?? 0} parsed requirements
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(selectedJob?.required_skills ?? []).map((skill) => (
                      <Badge key={skill} tone="brand">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                onClick={search}
                loading={searching}
                disabled={jobId === "adhoc" && description.trim().length < 30}
              >
                <Search />
                Search candidates
              </Button>
            </CardContent>
          </Card>

          {/* Detected requirements */}
          {parsed ? (
            <Card className="animate-fade-up">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-brand" />
                  Detected requirements
                </CardTitle>
                <p className="text-[12.5px] text-ink-tertiary">
                  Extracted by the {parsed.engine} engine.
                </p>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <RequirementGroup label="Required skills" items={parsed.required_skills} tone="brand" />
                <RequirementGroup
                  label="Nice to have"
                  items={parsed.nice_to_have_skills}
                  tone="neutral"
                />
                <div className="flex flex-wrap gap-4 text-[13px]">
                  {parsed.min_experience_years ? (
                    <Fact label="Experience">{parsed.min_experience_years}+ years</Fact>
                  ) : null}
                  {parsed.seniority ? <Fact label="Seniority">{parsed.seniority}</Fact> : null}
                  {parsed.locations.length > 0 ? (
                    <Fact label="Location">{parsed.locations.join(", ")}</Fact>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Filters rail */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Minimum match" hint={`${minScore}%`}>
                <input
                  type="range"
                  min={0}
                  max={95}
                  step={5}
                  value={minScore}
                  onChange={(event) => setMinScore(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-[var(--brand)]"
                  aria-label="Minimum match score"
                />
              </Field>

              <Field label="Location">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-tertiary" />
                  <Input
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    placeholder="Any location"
                    className="pl-8"
                  />
                </div>
              </Field>

              <Field label="Sort by">
                <Select value={sort} onValueChange={setSort} options={SORT_OPTIONS} ariaLabel="Sort" />
              </Field>
            </CardContent>
          </Card>

          {status ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2.5">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-ink-tertiary" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">
                      {status.providers.find((item) => item.name === "People Search")?.mode ===
                      "mock"
                        ? "Mock dataset"
                        : "Live provider"}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                      {status.providers.find((item) => item.name === "People Search")?.detail}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      {/* Results */}
      <section className="mt-8">
        {error ? (
          <Card>
            <ErrorState message={error} onRetry={search} />
          </Card>
        ) : searching ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : results ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  {visible.length} candidate{visible.length === 1 ? "" : "s"}
                  {results.total > results.results.length ? ` of ${results.total} matched` : ""}
                </h2>
                {results.notice ? (
                  <p className="mt-0.5 max-w-2xl text-[12px] text-ink-tertiary">{results.notice}</p>
                ) : null}
              </div>

              {selected.size > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-ink-secondary">{selected.size} selected</span>
                  <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
                    <Bookmark />
                    Save to pool
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleOutreach} loading={saving}>
                    <PhoneOutgoing />
                    Start AI outreach
                  </Button>
                </div>
              ) : null}
            </div>

            {visible.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {visible.map((profile) => (
                  <SourcedProfileCard
                    key={profile.provider_profile_id}
                    profile={profile}
                    selected={selected.has(profile.provider_profile_id)}
                    onToggle={(checked) => toggle(profile.provider_profile_id, checked)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={<Radar />}
                  title="No candidates match these filters"
                  description="Lower the minimum match score or clear the location filter."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMinScore(0);
                        setLocationFilter("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            )}
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<Radar />}
              title="Ready when you are"
              description="Pick a role or paste a job description, then run the search to see ranked candidate matches."
            />
          </Card>
        )}
      </section>

      <StartOutreachDialog
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        candidateIds={outreachIds}
        candidateLabel={`${outreachIds.length} candidate${outreachIds.length === 1 ? "" : "s"}`}
        defaultJobId={jobId !== "adhoc" ? jobId : undefined}
      />
    </>
  );
}

function RequirementGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "brand" | "neutral";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] uppercase tracking-wide text-ink-tertiary">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <Badge
            key={item}
            tone={tone}
            className={cn("animate-fade-up")}
            style={{ animationDelay: `${index * 35}ms` }}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11.5px] uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="mt-0.5 font-medium text-ink">{children}</p>
    </div>
  );
}
