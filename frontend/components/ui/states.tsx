import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* --- Loading -------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-surface-sunken", className)}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-3.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-3", columnIndex === 0 ? "w-40" : "w-20")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* --- Empty ---------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-muted text-ink-tertiary [&_svg]:size-5">
        {icon ?? <Inbox />}
      </div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* --- Error ---------------------------------------------------------------- */

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-danger-soft bg-danger-soft text-danger-text [&_svg]:size-5">
        <AlertTriangle />
      </div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-secondary">
        {message ?? "The request could not be completed. Please try again."}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Wraps a data region and renders the right state without repeating the logic. */
export function DataBoundary({
  isLoading,
  error,
  isEmpty,
  loadingFallback,
  emptyFallback,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error?: { message: string } | null;
  isEmpty?: boolean;
  loadingFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) return <>{loadingFallback ?? <TableSkeleton />}</>;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (isEmpty) return <>{emptyFallback ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children}</>;
}
