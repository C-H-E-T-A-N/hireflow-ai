import { cn } from "@/lib/utils";

/**
 * HireFlow mark: three rising bars (a pipeline advancing) inside a rounded
 * square, with a soundwave notch that reads as voice.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="hireflow-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.2 285)" />
          <stop offset="100%" stopColor="oklch(0.48 0.21 272)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill="url(#hireflow-mark)" />
      <rect x="8" y="17" width="3.2" height="7" rx="1.6" fill="white" fillOpacity="0.65" />
      <rect x="14.4" y="12" width="3.2" height="12" rx="1.6" fill="white" fillOpacity="0.85" />
      <rect x="20.8" y="8" width="3.2" height="16" rx="1.6" fill="white" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo className="size-8" />
      <span className="text-[17px] font-semibold tracking-tight text-ink">HireFlow</span>
      <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-text">
        AI
      </span>
    </span>
  );
}
