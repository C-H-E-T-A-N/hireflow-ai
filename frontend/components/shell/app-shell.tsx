"use client";

import { Menu, X } from "lucide-react";
import * as React from "react";

import { DemoModeNotice } from "@/components/ai/voice";
import { SidebarNav } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/primitives";
import { useApi } from "@/hooks/use-api";
import type { SystemStatus } from "@/types/api";

const CURRENT_USER = { name: "Chetan Sharma", role: "Talent Acquisition Lead" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { data: status } = useApi<SystemStatus>("/system/status");

  // Close the drawer whenever the viewport grows past the breakpoint.
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => setMobileOpen(false);
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-canvas">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface-muted lg:block">
          <SidebarNav />
          <SidebarFooter user={CURRENT_USER} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-[oklch(0.21_0.014_268/0.45)] animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 animate-slide-in border-r border-line bg-surface-muted">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-3"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X />
              </Button>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
              <SidebarFooter user={CURRENT_USER} />
            </div>
          </div>
        ) : null}

        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>

            <div className="ml-auto flex items-center gap-2.5">
              {status ? <DemoModeNotice mode={status.voice_mode} compact /> : null}
              <ThemeToggle />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarFooter({ user }: { user: { name: string; role: string } }) {
  return (
    <div className="absolute inset-x-0 bottom-0 border-t border-line p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <Avatar name={user.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
          <p className="truncate text-[11.5px] text-ink-tertiary">{user.role}</p>
        </div>
      </div>
    </div>
  );
}

/** Standard page header used at the top of every screen. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
