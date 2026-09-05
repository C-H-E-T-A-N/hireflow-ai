"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Interactive architecture diagram for the voice-first attendance system.
 *
 * Hand-drawn SVG rather than a diagramming library so it inherits the design
 * tokens, works in both themes, and stays selectable/clickable.
 */

export interface ArchitectureNode {
  id: string;
  label: string;
  sublabel: string;
  lane: "edge" | "voice" | "core" | "data";
}

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  { id: "employee", label: "Employee", sublabel: "Any handset — feature phone, landline, shared desk phone", lane: "edge" },
  { id: "telephony", label: "Telephony / IVR", sublabel: "Location-specific DID answered by the carrier", lane: "edge" },
  { id: "agent", label: "Voice AI agent", sublabel: "Hunar.ai agent runs the check-in conversation", lane: "voice" },
  { id: "identity", label: "Identity verification", sublabel: "Caller ID → employee code → voiceprint or PIN", lane: "voice" },
  { id: "location", label: "Location verification", sublabel: "Dialled number binds the call to a site", lane: "voice" },
  { id: "attendance", label: "Attendance service", sublabel: "Idempotent write, shift rules, late/absent logic", lane: "core" },
  { id: "database", label: "PostgreSQL", sublabel: "Attendance events, employees, locations, audit trail", lane: "data" },
  { id: "dashboard", label: "HR dashboard", sublabel: "Live roll-up, exceptions queue, payroll export", lane: "data" },
];

const LANE_STYLES: Record<ArchitectureNode["lane"], { fill: string; stroke: string; text: string }> = {
  edge: { fill: "var(--surface-muted)", stroke: "var(--border-strong)", text: "var(--text-primary)" },
  voice: { fill: "var(--brand-soft)", stroke: "var(--brand-soft-border)", text: "var(--brand-text)" },
  core: { fill: "var(--info-soft)", stroke: "var(--info)", text: "var(--info-text)" },
  data: { fill: "var(--positive-soft)", stroke: "var(--positive)", text: "var(--positive-text)" },
};

const NODE_HEIGHT = 58;
const NODE_GAP = 26;
const NODE_WIDTH = 300;
const SVG_WIDTH = 520;

export function ArchitectureDiagram({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const height = ARCHITECTURE_NODES.length * (NODE_HEIGHT + NODE_GAP);
  const left = (SVG_WIDTH - NODE_WIDTH) / 2;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${height}`}
      className="w-full"
      role="img"
      aria-label="Voice attendance system architecture: employee calls a location number, a voice AI agent verifies identity and location, and the attendance service writes to PostgreSQL for the HR dashboard."
    >
      <defs>
        <marker
          id="attendance-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
        </marker>
      </defs>

      {ARCHITECTURE_NODES.map((node, index) => {
        const y = index * (NODE_HEIGHT + NODE_GAP);
        const style = LANE_STYLES[node.lane];
        const isActive = activeId === node.id;

        return (
          <g key={node.id}>
            {index < ARCHITECTURE_NODES.length - 1 ? (
              <line
                x1={SVG_WIDTH / 2}
                y1={y + NODE_HEIGHT}
                x2={SVG_WIDTH / 2}
                y2={y + NODE_HEIGHT + NODE_GAP - 4}
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                markerEnd="url(#attendance-arrow)"
              />
            ) : null}

            <g
              className="cursor-pointer"
              onClick={() => onSelect(node.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(node.id);
              }}
              aria-label={`${node.label}: ${node.sublabel}`}
            >
              <rect
                x={left}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="11"
                fill={style.fill}
                stroke={isActive ? "var(--brand)" : style.stroke}
                strokeWidth={isActive ? 2 : 1}
                className="transition-all duration-200"
              />
              <text
                x={SVG_WIDTH / 2}
                y={y + 24}
                textAnchor="middle"
                fill={style.text}
                className="text-[13px] font-semibold"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {node.label}
              </text>
              <text
                x={SVG_WIDTH / 2}
                y={y + 42}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                style={{ fontSize: 10.5 }}
              >
                {truncate(node.sublabel, 58)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Compact stacked version for narrow viewports. */
export function ArchitectureList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="space-y-2">
      {ARCHITECTURE_NODES.map((node, index) => {
        const style = LANE_STYLES[node.lane];
        const isActive = activeId === node.id;
        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                isActive ? "border-brand" : "border-line hover:border-line-strong",
              )}
              style={{ backgroundColor: style.fill }}
            >
              <span
                className="tabular mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[10.5px] font-bold"
                style={{ color: style.text, border: `1px solid ${style.stroke}` }}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: style.text }}>
                  {node.label}
                </span>
                <span className="block text-[11.5px] leading-relaxed text-ink-tertiary">
                  {node.sublabel}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
