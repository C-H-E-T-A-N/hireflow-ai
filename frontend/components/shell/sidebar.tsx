"use client";

import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  MessagesSquare,
  Mic,
  PhoneOutgoing,
  Radar,
  ScanFace,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Logo } from "@/components/shell/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sourcing",
    items: [
      { href: "/jobs", label: "Jobs", icon: Briefcase },
      { href: "/people-search", label: "People Search", icon: Radar },
      { href: "/candidates", label: "Candidates", icon: Users },
    ],
  },
  {
    label: "Voice AI",
    items: [
      { href: "/outreach", label: "AI Outreach", icon: PhoneOutgoing },
      { href: "/interviews", label: "AI Interviews", icon: Mic },
      { href: "/conversations", label: "Conversations", icon: MessagesSquare },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/attendance", label: "Attendance", icon: ScanFace },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">HireFlow</span>
          <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-text">
            AI
          </span>
        </Link>
      </div>

      <div className="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-tertiary">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-surface text-ink shadow-xs"
                          : "text-ink-secondary hover:bg-surface/70 hover:text-ink",
                      )}
                    >
                      {active ? (
                        <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active ? "text-brand" : "text-ink-tertiary group-hover:text-ink-secondary",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
