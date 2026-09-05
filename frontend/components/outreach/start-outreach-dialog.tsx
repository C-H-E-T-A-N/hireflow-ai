"use client";

import { PhoneOutgoing } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DemoModeNotice } from "@/components/ai/voice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/primitives";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { JobStats, ListResponse, OutreachDetail, SystemStatus } from "@/types/api";

/**
 * Queues an AI voice outreach batch for the selected candidates.
 * Shared by the candidate profile, the candidates list and People Search.
 */
export function StartOutreachDialog({
  open,
  onOpenChange,
  candidateIds,
  candidateLabel,
  defaultJobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  candidateLabel: string;
  defaultJobId?: string;
}) {
  const router = useRouter();
  const { data: jobs } = useApi<ListResponse<JobStats>>("/jobs", { enabled: open });
  const { data: status } = useApi<SystemStatus>("/system/status", { enabled: open });

  const [pickedJobId, setPickedJobId] = React.useState<string>();
  const [persona, setPersona] = React.useState("Riya");
  const [submitting, setSubmitting] = React.useState(false);

  // Derived rather than synchronised: an explicit pick wins, otherwise the
  // caller's suggestion, otherwise the first available job.
  const jobId = pickedJobId ?? defaultJobId ?? jobs?.items[0]?.id;

  const jobOptions = (jobs?.items ?? []).map((job) => ({
    value: job.id,
    label: `${job.title}${job.location ? ` · ${job.location}` : ""}`,
  }));

  const submit = async () => {
    if (!jobId) {
      toast.error("Choose the role this outreach is for.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post<ListResponse<OutreachDetail>>("/outreach", {
        job_id: jobId,
        candidate_ids: candidateIds,
        agent_persona_name: persona.trim() || "Riya",
        start_immediately: true,
      });
      toast.success(
        `AI outreach started for ${created.total} candidate${created.total === 1 ? "" : "s"}.`,
      );
      onOpenChange(false);
      const first = created.items[0];
      router.push(first ? `/outreach/${first.id}` : "/outreach");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the outreach.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start AI voice outreach</DialogTitle>
          <DialogDescription>
            An AI recruiter will call {candidateLabel}, confirm interest, and extract their current
            role, experience, location, notice period and compensation expectations.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {status ? <DemoModeNotice mode={status.voice_mode} /> : null}

          <Field label="Role" hint="Used to brief the agent">
            <Select
              value={jobId}
              onValueChange={setPickedJobId}
              options={jobOptions}
              placeholder="Select a job"
              ariaLabel="Role"
            />
          </Field>

          <Field label="Agent name" hint="How the AI introduces itself">
            <Input
              value={persona}
              onChange={(event) => setPersona(event.target.value)}
              placeholder="Riya"
              maxLength={40}
            />
          </Field>

          <div className="rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] text-ink-secondary">
            {candidateIds.length} candidate{candidateIds.length === 1 ? "" : "s"} will be queued.
            Calls run one per candidate and results appear on the outreach dashboard as they finish.
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            <PhoneOutgoing />
            Start outreach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
