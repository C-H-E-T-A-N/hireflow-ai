import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesColumn,
  Mic,
  PhoneOutgoing,
  Radar,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { LogoWordmark } from "@/components/shell/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    icon: Radar,
    title: "Intelligent candidate search",
    body: "Paste a job description. HireFlow extracts the real requirements and searches a pluggable people-search provider, ranking every profile with an explainable match score.",
  },
  {
    icon: PhoneOutgoing,
    title: "Automated voice outreach",
    body: "An AI recruiter calls your shortlist, asks the qualifying questions, and returns structured answers: interest, notice period, location and compensation.",
  },
  {
    icon: Mic,
    title: "AI voice interviews",
    body: "Configure focus areas, difficulty and duration. The AI interviewer runs a structured conversation and scores it against a rubric, not a vibe.",
  },
  {
    icon: BrainCircuit,
    title: "Candidate intelligence",
    body: "Every call becomes a transcript, an extracted answer set, an AI summary and a recommendation, all attached to the candidate record.",
  },
];

const FLOW = [
  { label: "Job description", detail: "Parsed into structured requirements" },
  { label: "People search", detail: "Ranked, explainable matches" },
  { label: "AI voice outreach", detail: "Qualified in one call" },
  { label: "AI interview", detail: "Structured and scored" },
  { label: "Shortlist", detail: "Evidence-backed recommendation" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <LogoWordmark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/attendance">Attendance design</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/dashboard">
                Enter workspace
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 size-[620px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 68%)" }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <div className="max-w-3xl">
              <Badge tone="brand" className="animate-fade-in">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                </span>
                Voice AI recruiting, end to end
              </Badge>

              <h1 className="mt-5 animate-fade-up text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
                AI-powered recruiting
                <br />
                from sourcing to interview.
              </h1>

              <p className="mt-5 max-w-2xl animate-fade-up text-[16.5px] leading-relaxed text-ink-secondary sm:text-lg">
                HireFlow finds the right people, calls them with an AI voice agent, extracts what
                you actually need to know, and interviews the promising ones — so your recruiters
                spend their day on the shortlist, not the long list.
              </p>

              <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" asChild>
                  <Link href="/dashboard">
                    Open the demo workspace
                    <ArrowRight />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <Link href="/people-search">Try candidate search</Link>
                </Button>
              </div>

              <p className="mt-4 text-[12.5px] text-ink-tertiary">
                No sign-up. The workspace is preloaded with demo data so you can see the whole
                workflow immediately.
              </p>
            </div>

            {/* Pipeline strip */}
            <div className="mt-16 grid animate-fade-up gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {FLOW.map((step, index) => (
                <div
                  key={step.label}
                  className="surface-card relative p-4"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="tabular text-[11px] font-semibold text-brand-text">
                    0{index + 1}
                  </span>
                  <p className="mt-1.5 text-[13.5px] font-semibold text-ink">{step.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-tertiary">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            One workspace for the whole funnel
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            Sourcing, outreach and interviewing usually live in three tools that do not talk to each
            other. HireFlow keeps them on one candidate record.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => {
              const Icon = capability.icon;
              return (
                <div
                  key={capability.title}
                  className="surface-card group p-6 transition-all duration-200 hover:border-line-strong hover:shadow-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl border border-brand-soft-border bg-brand-soft text-brand-text transition-transform duration-200 group-hover:scale-105">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{capability.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                    {capability.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Secondary */}
        <section className="border-y border-line bg-surface-muted">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-3">
            <Highlight
              icon={ChartNoAxesColumn}
              title="Explainable scoring"
              body="Every match score breaks down into skills, experience and location. Every interview score maps to a rubric of expected signals. Nothing is a black box."
            />
            <Highlight
              icon={ShieldCheck}
              title="Keys stay on the server"
              body="The browser talks only to a Next.js proxy. Voice, people-search and model credentials never reach the client bundle."
            />
            <Highlight
              icon={ScanFace}
              title="Voice-first attendance"
              body="A separate system design for tracking 1,000 employees across 100 sites over a phone line — no smartphones, no apps."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            See it working in under a minute
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
            The workspace ships preloaded with jobs, candidates, completed voice conversations and
            scored interviews.
          </p>
          <Button variant="primary" size="lg" className="mt-7" asChild>
            <Link href="/dashboard">
              Enter workspace
              <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[12.5px] text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
          <span>HireFlow AI — built for the Hunar.ai assignment.</span>
          <span>Voice by Hunar.ai · Demo mode uses simulated conversations.</span>
        </div>
      </footer>
    </div>
  );
}

function Highlight({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="size-5 text-brand" />
      <h3 className="mt-3 text-[14.5px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}
