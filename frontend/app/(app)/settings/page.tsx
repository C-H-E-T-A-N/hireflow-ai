"use client";

import { CheckCircle2, KeyRound, ShieldCheck, XCircle } from "lucide-react";

import { DemoModeNotice } from "@/components/ai/voice";
import { PageHeader } from "@/components/shell/app-shell";
import { ThemeToggle } from "@/components/shell/theme";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { humanise } from "@/lib/utils";
import type { SystemStatus } from "@/types/api";

const ENV_VARS = [
  {
    name: "HUNAR_API_KEY",
    purpose: "Authenticates every call to the Hunar Voice Agents API.",
    scope: "Backend only",
  },
  {
    name: "HUNAR_WEBHOOK_SECRET",
    purpose: "Verifies the HMAC signature on inbound Hunar webhooks.",
    scope: "Backend only",
  },
  {
    name: "DEMO_MODE",
    purpose: "When true, conversations are simulated and no calls are placed.",
    scope: "Backend only",
  },
  {
    name: "PEOPLE_SEARCH_PROVIDER",
    purpose: "Selects the sourcing provider: mock or pdl.",
    scope: "Backend only",
  },
  {
    name: "PDL_API_KEY",
    purpose: "Credential for the live People Data Labs provider.",
    scope: "Backend only",
  },
  {
    name: "LLM_PROVIDER / ANTHROPIC_API_KEY",
    purpose: "Upgrades JD parsing, summaries and evaluation to a real model.",
    scope: "Backend only",
  },
  {
    name: "DATABASE_URL",
    purpose: "PostgreSQL connection string. Falls back to local SQLite.",
    scope: "Backend only",
  },
  {
    name: "BACKEND_API_URL",
    purpose: "Where the Next.js proxy forwards browser requests.",
    scope: "Frontend server only",
  },
];

export default function SettingsPage() {
  const { data, error, isLoading, refresh } = useApi<SystemStatus>("/system/status");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace configuration and the state of every integration."
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={refresh} />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <p className="text-[13px] text-ink-secondary">
                  Configured server-side. This screen reports whether a credential is present — it
                  never returns the value itself.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-20 rounded-xl" />
                    ))
                  : data?.providers.map((provider) => (
                      <div
                        key={provider.name}
                        className="flex items-start gap-3 rounded-xl border border-line p-4"
                      >
                        {provider.configured ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
                        ) : (
                          <XCircle className="mt-0.5 size-4 shrink-0 text-ink-tertiary" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13.5px] font-semibold text-ink">{provider.name}</p>
                            <Badge
                              tone={
                                provider.mode === "live"
                                  ? "positive"
                                  : provider.mode === "mock" || provider.mode === "demo"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {humanise(provider.mode)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
                            {provider.detail}
                          </p>
                        </div>
                      </div>
                    ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <KeyRound className="size-4 text-ink-tertiary" />
                  Environment variables
                </CardTitle>
                <p className="text-[13px] text-ink-secondary">
                  Every secret lives on the server. The browser talks to a Next.js proxy route, so
                  no key is ever bundled into client JavaScript.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto scrollbar-slim">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-tertiary">
                        <th className="py-2 pr-4 font-medium">Variable</th>
                        <th className="py-2 pr-4 font-medium">Purpose</th>
                        <th className="py-2 font-medium">Scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {ENV_VARS.map((variable) => (
                        <tr key={variable.name}>
                          <td className="py-2.5 pr-4">
                            <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
                              {variable.name}
                            </code>
                          </td>
                          <td className="py-2.5 pr-4 text-[12.5px] text-ink-secondary">
                            {variable.purpose}
                          </td>
                          <td className="py-2.5 text-[12px] text-ink-tertiary">{variable.scope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Appearance</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-[13px] text-ink-secondary">Colour theme</span>
                <ThemeToggle />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Workspace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[13px]">
                <Row label="Product" value={data?.app_name ?? "HireFlow AI"} />
                <Row label="Environment" value={humanise(data?.environment ?? "—")} />
                <Row label="Voice mode" value={humanise(data?.voice_mode ?? "—")} />
                <Row
                  label="Search providers"
                  value={(data?.available_people_search_providers ?? []).join(", ") || "—"}
                />
              </CardContent>
            </Card>

            {data ? <DemoModeNotice mode={data.voice_mode} /> : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-ink-tertiary" />
                  Security posture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-[12.5px] text-ink-secondary">
                  {[
                    "API keys are read from the server environment only",
                    "Browser requests are proxied server-side",
                    "Webhook deliveries are HMAC-verified",
                    "Request and response bodies are schema-validated",
                    "Internal errors never return stack traces",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-positive" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-tertiary">{label}</span>
      <span className="truncate font-medium text-ink">{value}</span>
    </div>
  );
}
