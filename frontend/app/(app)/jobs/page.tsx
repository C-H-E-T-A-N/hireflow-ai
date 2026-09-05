"use client";

import { Briefcase, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatCurrencyRange, humanise } from "@/lib/utils";
import type { Job, JobStats, ListResponse } from "@/types/api";

const STATUS_TONES = {
  open: "positive",
  draft: "neutral",
  paused: "warning",
  closed: "neutral",
} as const;

export default function JobsPage() {
  const { data, error, isLoading, refresh } = useApi<ListResponse<JobStats>>("/jobs");
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Every open role. Descriptions are parsed into structured requirements that power search, matching and interview question generation."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus />
            New job
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error.message} onRetry={refresh} />
        </Card>
      ) : data && data.items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((job) => (
            <Card key={job.id} interactive className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="min-w-0 text-[15px] font-semibold text-ink hover:text-brand-text"
                  >
                    {job.title}
                  </Link>
                  <Badge tone={STATUS_TONES[job.status as keyof typeof STATUS_TONES] ?? "neutral"}>
                    {humanise(job.status)}
                  </Badge>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-tertiary">
                  {job.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {job.location}
                    </span>
                  ) : null}
                  {job.department ? <span>{job.department}</span> : null}
                  {job.min_experience_years ? (
                    <span>{job.min_experience_years}+ yrs</span>
                  ) : null}
                </div>

                {formatCurrencyRange(job.salary_min, job.salary_max, job.salary_currency) ? (
                  <p className="mt-2 text-[13px] font-medium text-ink">
                    {formatCurrencyRange(job.salary_min, job.salary_max, job.salary_currency)}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.required_skills.slice(0, 5).map((skill) => (
                    <Badge key={skill} tone="brand">
                      {skill}
                    </Badge>
                  ))}
                  {job.required_skills.length > 5 ? (
                    <span className="text-[11.5px] text-ink-tertiary">
                      +{job.required_skills.length - 5}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <Stat label="Candidates" value={job.candidate_count} />
                  <Stat label="Outreach" value={job.outreach_count} />
                  <Stat label="Interviews" value={job.interview_count} />
                </div>

                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" asChild>
                    <Link href={`/jobs/${job.id}`}>Details</Link>
                  </Button>
                  <Button variant="primary" size="sm" className="flex-1" asChild>
                    <Link href="/people-search">
                      <Users />
                      Source
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Briefcase />}
            title="No jobs yet"
            description="Create a job and paste its description — HireFlow will extract the requirements automatically."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus />
                New job
              </Button>
            }
          />
        </Card>
      )}

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="tabular text-[15px] font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-ink-tertiary">{label}</p>
    </div>
  );
}

function CreateJobDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error("Give the job a title.");
      return;
    }
    setSubmitting(true);
    try {
      const job = await api.post<Job>("/jobs", {
        title: title.trim(),
        location: location.trim() || undefined,
        department: department.trim() || undefined,
        description,
      });
      toast.success(
        job.required_skills.length > 0
          ? `Job created. Extracted ${job.required_skills.length} requirements from the description.`
          : "Job created.",
      );
      onOpenChange(false);
      onCreated();
      router.push(`/jobs/${job.id}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not create the job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
          <DialogDescription>
            Paste the full description. HireFlow parses it into required skills, experience and
            location, which then drive candidate search and interview questions.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Senior Full Stack Developer"
              />
            </Field>
            <Field label="Location" hint="Optional">
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Gurgaon, Delhi NCR"
              />
            </Field>
          </div>

          <Field label="Department" hint="Optional">
            <Input
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Engineering"
            />
          </Field>

          <Field label="Job description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={10}
              placeholder="Paste the full job description…"
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            Create job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
