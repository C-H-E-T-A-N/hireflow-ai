"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { avatarTint, cn, initials } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full ring-1 ring-line",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name} className="aspect-square size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        className={cn(
          "flex size-full items-center justify-center font-semibold tracking-tight",
          avatarTint(name),
        )}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** Overlapping avatar stack for compact lists. */
export function AvatarGroup({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name) => (
        <Avatar key={name} name={name} size="xs" className="ring-2 ring-surface" />
      ))}
      {overflow > 0 ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-ink-secondary ring-2 ring-surface">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
