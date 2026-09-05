"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/* --- Input ---------------------------------------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-xs transition-colors",
        "placeholder:text-ink-tertiary focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink shadow-xs transition-colors",
      "placeholder:text-ink-tertiary focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)]",
      "scrollbar-slim resize-y",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label
      className={cn("mb-1.5 flex items-center justify-between text-[13px] font-medium text-ink", className)}
      {...props}
    >
      <span>{children}</span>
      {hint ? <span className="text-[12px] font-normal text-ink-tertiary">{hint}</span> : null}
    </label>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  );
}

/* --- Select --------------------------------------------------------------- */

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  className,
  ariaLabel,
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-xs transition-colors",
          "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)]",
          "data-[placeholder]:text-ink-tertiary",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 shrink-0 text-ink-tertiary" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface shadow-lg",
            "data-[state=open]:animate-fade-in",
          )}
        >
          <SelectPrimitive.Viewport className="scrollbar-slim p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-3 pr-8 text-sm text-ink outline-none",
                  "data-[highlighted]:bg-surface-muted data-[state=checked]:font-medium",
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="size-3.5 text-brand" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* --- Checkbox / Switch ---------------------------------------------------- */

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      aria-label={ariaLabel}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface transition-colors",
        "data-[state=checked]:border-brand data-[state=checked]:bg-brand",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border border-transparent bg-surface-sunken transition-colors",
        "data-[state=checked]:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
      )}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

/* --- Progress ------------------------------------------------------------- */

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={clamped}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full bg-brand transition-[width] duration-700 ease-out", indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

/* --- Tabs ----------------------------------------------------------------- */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-line bg-surface-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-all",
        "hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("animate-fade-in focus-visible:outline-none", className)}
      {...props}
    />
  );
}

/* --- Misc ----------------------------------------------------------------- */

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs animate-fade-in rounded-lg bg-surface-inverted px-2.5 py-1.5 text-[12px] font-medium text-ink-inverted shadow-md"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
