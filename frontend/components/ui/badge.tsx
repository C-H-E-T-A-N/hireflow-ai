import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn, humanise } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-muted text-ink-secondary",
        brand: "border-brand-soft-border bg-brand-soft text-brand-text",
        positive: "border-transparent bg-positive-soft text-positive-text",
        warning: "border-transparent bg-warning-soft text-warning-text",
        danger: "border-transparent bg-danger-soft text-danger-text",
        info: "border-transparent bg-info-soft text-info-text",
        outline: "border-line-strong bg-transparent text-ink-secondary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* --- Domain-aware status pills ------------------------------------------- */

const STAGE_TONES: Record<string, BadgeTone> = {
  sourced: "neutral",
  contacted: "info",
  interested: "positive",
  not_interested: "danger",
  interview_scheduled: "brand",
  interview_completed: "brand",
  shortlisted: "positive",
  rejected: "danger",
  hired: "positive",
};

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <Badge tone={STAGE_TONES[stage] ?? "neutral"} className={className}>
      {humanise(stage)}
    </Badge>
  );
}

const CALL_STATUS_TONES: Record<string, BadgeTone> = {
  draft: "neutral",
  queued: "neutral",
  scheduled: "info",
  dialing: "warning",
  in_progress: "brand",
  processing: "brand",
  completed: "positive",
  no_answer: "warning",
  failed: "danger",
  cancelled: "neutral",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const isLive = status === "dialing" || status === "in_progress";
  return (
    <Badge tone={CALL_STATUS_TONES[status] ?? "neutral"} className={className}>
      {isLive ? <LivePip /> : null}
      {humanise(status)}
    </Badge>
  );
}

const RECOMMENDATION_TONES: Record<string, BadgeTone> = {
  strong_hire: "positive",
  shortlist: "positive",
  consider: "warning",
  reject: "danger",
  pending: "neutral",
  high_potential: "positive",
  worth_pursuing: "info",
  nurture: "warning",
  disqualify: "danger",
};

export function RecommendationBadge({
  recommendation,
  className,
}: {
  recommendation: string;
  className?: string;
}) {
  return (
    <Badge tone={RECOMMENDATION_TONES[recommendation] ?? "neutral"} className={className}>
      {humanise(recommendation)}
    </Badge>
  );
}

const INTEREST_TONES: Record<string, BadgeTone> = {
  interested: "positive",
  maybe_later: "warning",
  not_interested: "danger",
  unknown: "neutral",
};

export function InterestBadge({ level, className }: { level: string; className?: string }) {
  return (
    <Badge tone={INTEREST_TONES[level] ?? "neutral"} className={className}>
      {humanise(level)}
    </Badge>
  );
}

/** Pulsing dot used to mark a call that is happening right now. */
export function LivePip({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-1.5", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-1.5 rounded-full bg-current" />
    </span>
  );
}

/** Small chip for a skill or keyword. */
export function SkillChip({
  children,
  matched,
  className,
}: {
  children: React.ReactNode;
  matched?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium",
        matched
          ? "border-positive-soft bg-positive-soft text-positive-text"
          : "border-line bg-surface-muted text-ink-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}
