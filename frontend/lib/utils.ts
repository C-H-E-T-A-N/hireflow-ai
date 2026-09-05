import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Title-cases a snake_case enum value coming from the API. */
export function humanise(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Deterministic avatar tint derived from the name, so a person keeps the same
 * colour everywhere in the product without us storing one.
 */
const AVATAR_TINTS = [
  "bg-[oklch(0.93_0.05_279)] text-[oklch(0.42_0.17_279)]",
  "bg-[oklch(0.93_0.05_200)] text-[oklch(0.4_0.13_200)]",
  "bg-[oklch(0.93_0.05_162)] text-[oklch(0.4_0.11_162)]",
  "bg-[oklch(0.94_0.05_60)] text-[oklch(0.44_0.12_60)]",
  "bg-[oklch(0.93_0.05_22)] text-[oklch(0.45_0.15_22)]",
  "bg-[oklch(0.93_0.05_320)] text-[oklch(0.44_0.15_320)]",
];

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function formatRelativeTime(input: string | null | undefined): string {
  if (!input) return "—";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(input).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(input: string | null | undefined): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(input: string | null | undefined): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatCurrencyRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = "INR",
): string | null {
  if (!min && !max) return null;
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  const compact = (value: number) =>
    value >= 100000 ? `${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L` : value.toLocaleString();
  if (min && max) return `${symbol}${compact(min)} – ${symbol}${compact(max)}`;
  return `${symbol}${compact((min ?? max) as number)}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
