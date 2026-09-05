"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A small hand-built SVG chart kit.
 *
 * Deliberately not a charting library: every chart here is simple, and drawing
 * them directly keeps them on the design system's tokens, keeps the bundle
 * small, and avoids fighting a third party for control of the visuals.
 */

/* --- Sparkline ------------------------------------------------------------ */

export function Sparkline({
  values,
  className,
  stroke = "var(--brand)",
  height = 40,
}: {
  values: number[];
  className?: string;
  stroke?: string;
  height?: number;
}) {
  // Hooks must run before any early return.
  const gradientId = React.useId();

  if (values.length < 2) return <div className={cn("h-10", className)} />;

  const width = 100;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* --- Multi-series area chart --------------------------------------------- */

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

export function TimelineChart({
  data,
  series,
  height = 200,
}: {
  data: Array<Record<string, string | number>>;
  series: SeriesConfig[];
  height?: number;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-[13px] text-ink-tertiary">
        Not enough data to chart yet.
      </div>
    );
  }

  const width = 640;
  const padding = { top: 12, right: 8, bottom: 24, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...data.flatMap((row) => series.map((item) => Number(row[item.key] ?? 0))),
  );
  const ticks = niceTicks(max, 3);
  const scaleMax = ticks[ticks.length - 1];

  const xFor = (index: number) => padding.left + (index / (data.length - 1)) * plotWidth;
  const yFor = (value: number) => padding.top + plotHeight - (value / scaleMax) * plotHeight;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Activity over time: ${series.map((s) => s.label).join(", ")}`}
        onMouseLeave={() => setHovered(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="var(--border)"
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
            <text
              x={padding.left - 8}
              y={yFor(tick) + 3.5}
              textAnchor="end"
              className="fill-[var(--text-tertiary)] text-[9px] tabular"
            >
              {tick}
            </text>
          </g>
        ))}

        {series.map((item) => {
          const points = data.map(
            (row, index) => `${xFor(index)},${yFor(Number(row[item.key] ?? 0))}`,
          );
          return (
            <g key={item.key}>
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={item.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {hovered !== null ? (
                <circle
                  cx={xFor(hovered)}
                  cy={yFor(Number(data[hovered][item.key] ?? 0))}
                  r="3.5"
                  fill="var(--surface)"
                  stroke={item.color}
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}

        {hovered !== null ? (
          <line
            x1={xFor(hovered)}
            x2={xFor(hovered)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            stroke="var(--border-strong)"
          />
        ) : null}

        {data.map((row, index) => (
          <rect
            key={index}
            x={xFor(index) - plotWidth / data.length / 2}
            y={padding.top}
            width={plotWidth / data.length}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
          />
        ))}

        {data.map((row, index) =>
          index % Math.ceil(data.length / 7) === 0 ? (
            <text
              key={index}
              x={xFor(index)}
              y={height - 6}
              textAnchor="middle"
              className="fill-[var(--text-tertiary)] text-[9px]"
            >
              {formatShortDate(String(row.date))}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.label}
            {hovered !== null ? (
              <span className="tabular font-medium text-ink">{data[hovered][item.key]}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --- Funnel --------------------------------------------------------------- */

export function FunnelChart({
  stages,
}: {
  stages: Array<{ stage: string; count: number; percent: number }>;
}) {
  return (
    <div className="space-y-2.5">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1].count : stage.count;
        const dropOff = previous > 0 ? Math.round((1 - stage.count / previous) * 100) : 0;
        return (
          <div key={stage.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{stage.stage}</span>
              <span className="flex items-baseline gap-2">
                <span className="tabular text-[13px] font-semibold text-ink">{stage.count}</span>
                {index > 0 && dropOff > 0 ? (
                  <span className="tabular text-[11.5px] text-ink-tertiary">−{dropOff}%</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(stage.percent, stage.count > 0 ? 2 : 0)}%`,
                  background: `linear-gradient(90deg, var(--brand) 0%, color-mix(in oklch, var(--brand), var(--info) ${index * 16}%) 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --- Bars ----------------------------------------------------------------- */

export function BarChart({
  data,
  height = 160,
  color = "var(--brand)",
  emptyLabel = "No data yet.",
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-ink-tertiary">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((item) => (
        <div key={item.label} className="group flex flex-1 flex-col items-center gap-2">
          <span className="tabular text-[11px] font-medium text-ink-secondary opacity-0 transition-opacity group-hover:opacity-100">
            {item.value}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-110"
              style={{
                height: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 1)}%`,
                backgroundColor: color,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="text-[10.5px] text-ink-tertiary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* --- Donut ---------------------------------------------------------------- */

export function DonutChart({
  segments,
  size = 132,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth="10"
          />
          {total > 0 &&
            segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const element = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(dash - 3, 0)} ${circumference}`}
                  strokeDashoffset={-offset}
                  className="transition-all duration-700 ease-out"
                />
              );
              offset += dash;
              return element;
            })}
        </svg>
        {centerValue !== undefined ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-xl font-semibold text-ink">{centerValue}</span>
            {centerLabel ? (
              <span className="text-[11px] text-ink-tertiary">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="min-w-0 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: segment.color }}
              aria-hidden
            />
            <span className="truncate text-ink-secondary">{segment.label}</span>
            <span className="tabular ml-auto font-medium text-ink">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- Score meter ---------------------------------------------------------- */

export function ScoreRing({
  score,
  size = 92,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const radius = size / 2 - 7;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const colour =
    clamped >= 80 ? "var(--positive)" : clamped >= 60 ? "var(--brand)" : clamped >= 45 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth="7"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[19px] font-semibold leading-none text-ink">
          {Math.round(clamped)}
        </span>
        {label ? <span className="mt-0.5 text-[10px] text-ink-tertiary">{label}</span> : null}
      </div>
    </div>
  );
}

/** Horizontal competency bar used on the interview scorecard. */
export function ScoreBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const value = score ?? 0;
  const colour =
    value >= 80 ? "var(--positive)" : value >= 60 ? "var(--brand)" : value >= 45 ? "var(--warning)" : "var(--danger)";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] text-ink-secondary">{label}</span>
        <span className="tabular text-[13px] font-semibold text-ink">
          {score === null ? "—" : Math.round(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${value}%`, backgroundColor: colour }}
        />
      </div>
    </div>
  );
}

/* --- helpers -------------------------------------------------------------- */

function niceTicks(max: number, count: number): number[] {
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const step = Math.max(1, Math.ceil(rawStep / magnitude) * magnitude);
  const ticks: number[] = [];
  for (let value = 0; value <= step * count; value += step) ticks.push(value);
  return ticks;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
