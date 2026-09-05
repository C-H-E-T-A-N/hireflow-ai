"use client";

import { Bot, PhoneCall, Sparkles, Volume2, VolumeX } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The AI visual language: an animated waveform for a live call, a status dot
 * for the agent, and a labelled surface for anything the model generated.
 * Used sparingly - AI cues mark AI output, they are not decoration.
 */

const BAR_DELAYS = [0, 0.18, 0.36, 0.12, 0.48, 0.24, 0.06, 0.42, 0.3, 0.15];

export function VoiceWaveform({
  active,
  bars = 10,
  className,
  tone = "brand",
}: {
  active: boolean;
  bars?: number;
  className?: string;
  tone?: "brand" | "muted" | "inverted";
}) {
  const colour =
    tone === "inverted" ? "bg-white/80" : tone === "muted" ? "bg-ink-tertiary" : "bg-brand";

  return (
    <div
      className={cn("flex h-6 items-center gap-[3px]", className)}
      role="img"
      aria-label={active ? "Voice activity" : "No voice activity"}
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={cn("w-[3px] rounded-full transition-all duration-300", colour)}
          style={
            active
              ? {
                  height: "100%",
                  animation: `wave ${0.9 + (index % 3) * 0.25}s ease-in-out ${BAR_DELAYS[index % BAR_DELAYS.length]}s infinite`,
                }
              : { height: "20%", opacity: 0.35 }
          }
        />
      ))}
    </div>
  );
}

/**
 * Sound toggle for conversation playback.
 *
 * The label deliberately says "Read aloud" rather than "Play recording": a demo
 * conversation has no audio, so what you hear is the browser speaking the
 * transcript, not a recording of a call.
 */
export function SpeechToggle({
  enabled,
  onToggle,
  supported,
  className,
  label = "Read aloud",
  blocked = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  supported: boolean;
  className?: string;
  label?: string;
  /** The browser refused to speak until the page receives a user gesture. */
  blocked?: boolean;
}) {
  if (!supported) return null;

  if (blocked) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Your browser blocks sound until you interact with the page. Click to enable."
        className={cn(
          "inline-flex animate-pulse items-center gap-1.5 rounded-lg border border-warning-soft bg-warning-soft px-2.5 py-1.5 text-[12.5px] font-medium text-warning-text",
          className,
        )}
      >
        <Volume2 className="size-3.5" />
        Click to enable sound
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={
        enabled
          ? "Mute. The transcript is spoken by your browser, not a call recording."
          : "Read the conversation aloud using your browser's voice."
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
        enabled
          ? "border-brand-soft-border bg-brand-soft text-brand-text"
          : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {enabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
      {label}
    </button>
  );
}

export type AgentState = "ready" | "connecting" | "live" | "analyzing" | "done" | "failed";

const AGENT_COPY: Record<AgentState, { label: string; dot: string; text: string }> = {
  ready: { label: "Ready", dot: "bg-ink-tertiary", text: "text-ink-secondary" },
  connecting: { label: "Connecting", dot: "bg-warning", text: "text-warning-text" },
  live: { label: "Conversation active", dot: "bg-positive", text: "text-positive-text" },
  analyzing: { label: "Analysing", dot: "bg-brand", text: "text-brand-text" },
  done: { label: "Completed", dot: "bg-positive", text: "text-positive-text" },
  failed: { label: "Call failed", dot: "bg-danger", text: "text-danger-text" },
};

export function AgentStatus({
  state,
  className,
  label,
}: {
  state: AgentState;
  className?: string;
  label?: string;
}) {
  const config = AGENT_COPY[state];
  const animated = state === "live" || state === "connecting" || state === "analyzing";

  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-medium", config.text, className)}>
      <span className="relative flex size-2">
        {animated ? (
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", config.dot)} />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", config.dot)} />
      </span>
      {label ?? config.label}
    </span>
  );
}

/** Identity card for the AI interviewer / recruiter agent. */
export function AgentIdentity({
  name,
  role,
  state,
  className,
  compact = false,
}: {
  name: string;
  role: string;
  state: AgentState;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl border border-brand-soft-border bg-brand-soft text-brand-text",
          compact ? "size-9" : "size-11",
        )}
      >
        <Bot className={compact ? "size-4.5" : "size-5"} />
        {state === "live" ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-positive" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate font-semibold text-ink", compact ? "text-[13px]" : "text-sm")}>
          {name}
        </p>
        <div className="flex items-center gap-2">
          {compact ? null : <span className="text-[12px] text-ink-tertiary">{role}</span>}
          <AgentStatus state={state} className="text-[12px]" />
        </div>
      </div>
    </div>
  );
}

/** Marks a surface whose content was produced by the model. */
export function AiPanel({
  title = "AI summary",
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("ai-gradient rounded-xl border border-brand-soft-border p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-text">
          <Sparkles className="size-3.5" />
          {title}
        </span>
        {action}
      </div>
      <div className="text-[13.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** Banner shown while calls are simulated rather than dialled. */
export function DemoModeNotice({
  mode,
  className,
  compact = false,
}: {
  mode: "live" | "demo";
  className?: string;
  compact?: boolean;
}) {
  if (mode === "live") {
    if (compact) {
      return (
        <Badge tone="positive" className={className}>
          <PhoneCall className="size-3" />
          Live calling
        </Badge>
      );
    }

    // Live mode still simulates fabricated contacts, and saying so matters:
    // otherwise a demo-sourced candidate looks like a real completed call.
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-positive-soft bg-positive-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-positive-text",
          className,
        )}
      >
        <PhoneCall className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <span className="font-semibold">Live calling is enabled.</span> Calls are placed through
          Hunar.ai. Candidates sourced from the built-in mock dataset are still simulated, because
          their contact details are fabricated and must never be dialled. If the Hunar credential
          expires, conversations fall back to simulation automatically.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <Badge tone="warning" className={className}>
        Demo mode
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-warning-soft bg-warning-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warning-text",
        className,
      )}
    >
      <PhoneCall className="mt-0.5 size-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Demo mode.</span> Conversations are simulated by the built-in
        demo provider — no telephone call is placed and no candidate is contacted. Add a
        <code className="mx-1 rounded bg-black/5 px-1 py-0.5 font-mono text-[11px]">HUNAR_API_KEY</code>
        and set <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px]">DEMO_MODE=false</code> to
        place real calls.
      </p>
    </div>
  );
}
