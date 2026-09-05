"use client";

import { Bot, User } from "lucide-react";
import * as React from "react";

import { cn, formatClock } from "@/lib/utils";
import type { ConversationTurn } from "@/types/api";

/**
 * Conversation timeline. The AI agent and the candidate get deliberately
 * different treatments so the eye can separate them at a glance.
 */
export function Transcript({
  turns,
  agentName = "AI Agent",
  candidateName = "Candidate",
  live = false,
  autoScroll = false,
  className,
  emptyLabel = "The transcript will appear here as the conversation happens.",
  speakingSequence = null,
}: {
  turns: ConversationTurn[];
  agentName?: string;
  candidateName?: string;
  live?: boolean;
  autoScroll?: boolean;
  className?: string;
  emptyLabel?: string;
  /** Sequence number of the line currently being read aloud, if any. */
  speakingSequence?: number | null;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, autoScroll]);

  if (turns.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
          className,
        )}
      >
        {live ? (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-tertiary">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" />
            Waiting for the conversation to start…
          </span>
        ) : (
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-tertiary">{emptyLabel}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {turns.map((turn, index) => {
        const isAgent = turn.speaker === "agent";
        const isNew = live && index === turns.length - 1;
        const isSpeaking = speakingSequence === turn.sequence;

        return (
          <div
            key={turn.id}
            className={cn("flex gap-3", isNew && "animate-fade-up")}
          >
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                isAgent
                  ? "border-brand-soft-border bg-brand-soft text-brand-text"
                  : "border-line bg-surface-muted text-ink-secondary",
              )}
            >
              {isAgent ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[12px] font-semibold text-ink">
                  {isAgent ? agentName : candidateName}
                </span>
                {isSpeaking ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-brand-text">
                    <span className="size-1.5 animate-pulse rounded-full bg-brand" />
                    speaking
                  </span>
                ) : null}
                {turn.offset_seconds !== null ? (
                  <span className="tabular text-[11px] text-ink-tertiary">
                    {formatClock(turn.offset_seconds)}
                  </span>
                ) : null}
                {typeof turn.meta?.extracts === "string" ? (
                  <span className="rounded bg-info-soft px-1.5 py-0.5 text-[10px] font-medium text-info-text">
                    extracting {String(turn.meta.extracts)}
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed transition-shadow",
                  isAgent
                    ? "border border-brand-soft-border bg-brand-soft/60 text-ink"
                    : "border border-line bg-surface-muted text-ink",
                  isSpeaking && "ring-2 ring-[var(--ring)]",
                )}
              >
                {turn.content}
              </div>
            </div>
          </div>
        );
      })}

      {live ? (
        <div className="flex items-center gap-2 pl-10 text-[12px] text-ink-tertiary">
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 rounded-full bg-ink-tertiary"
                style={{
                  animation: `wave 1.2s ease-in-out ${dot * 0.18}s infinite`,
                }}
              />
            ))}
          </span>
          Listening
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}

/** Read-only key/value list of what the AI extracted from a conversation. */
export function ExtractedData({
  data,
  className,
}: {
  data: Record<string, unknown>;
  className?: string;
}) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return (
      <p className={cn("text-[13px] text-ink-tertiary", className)}>
        No structured data was extracted from this conversation.
      </p>
    );
  }

  return (
    <dl className={cn("divide-y divide-line", className)}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-[12.5px] text-ink-tertiary">
            {key.replace(/_/g, " ").replace(/^\w/, (character) => character.toUpperCase())}
          </dt>
          <dd className="max-w-[60%] text-right text-[13px] font-medium text-ink">
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value).replace(/_/g, " ");
}
