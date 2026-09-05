"use client";

import { Briefcase, ExternalLink, MapPin, PhoneOutgoing } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { MatchScore } from "@/components/dashboard/widgets";
import { Avatar } from "@/components/ui/avatar";
import { Badge, SkillChip, StageBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/primitives";
import { cn, humanise } from "@/lib/utils";
import type { CandidateListItem, SourcedProfile } from "@/types/api";

const AVAILABILITY_LABEL: Record<string, string> = {
  immediate: "Available now",
  one_month: "1 month notice",
  two_months: "2 months notice",
  three_months_plus: "3+ months",
  not_looking: "Not looking",
  unknown: "Availability unknown",
};

export function CandidateRow({ candidate }: { candidate: CandidateListItem }) {
  return (
    <Link
      href={`/candidates/${candidate.id}`}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
    >
      <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" />

      <div className="min-w-0 flex-[2]">
        <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand-text">
          {candidate.full_name}
        </p>
        <p className="truncate text-[12px] text-ink-tertiary">
          {candidate.current_title ?? "—"}
          {candidate.current_company ? ` · ${candidate.current_company}` : ""}
        </p>
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <p className="truncate text-[12.5px] text-ink-secondary">{candidate.location ?? "—"}</p>
        <p className="text-[11.5px] text-ink-tertiary">
          {candidate.experience_years ? `${candidate.experience_years} yrs` : "—"}
        </p>
      </div>

      <div className="hidden flex-[1.5] flex-wrap gap-1 lg:flex">
        {candidate.skills.slice(0, 3).map((skill) => (
          <SkillChip key={skill}>{skill}</SkillChip>
        ))}
        {candidate.skills.length > 3 ? (
          <span className="text-[11.5px] text-ink-tertiary">+{candidate.skills.length - 3}</span>
        ) : null}
      </div>

      <div className="hidden w-28 shrink-0 sm:block">
        <MatchScore score={candidate.match_score} />
      </div>

      <div className="w-32 shrink-0 text-right">
        <StageBadge stage={candidate.stage} />
      </div>
    </Link>
  );
}

/** Rich card used on the People Search results grid. */
export function SourcedProfileCard({
  profile,
  selected,
  onToggle,
  onOutreach,
}: {
  profile: SourcedProfile;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onOutreach?: () => void;
}) {
  const match = profile.match;

  return (
    <Card
      className={cn(
        "flex flex-col p-4 transition-all duration-200",
        selected
          ? "border-brand-soft-border ring-2 ring-[var(--ring)]"
          : "hover:border-line-strong hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            ariaLabel={`Select ${profile.full_name}`}
          />
        </div>
        <Avatar name={profile.full_name} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-semibold text-ink">{profile.full_name}</p>
              <p className="truncate text-[12.5px] text-ink-secondary">
                {profile.current_title ?? "—"}
              </p>
              {profile.current_company ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-tertiary">
                  <Briefcase className="size-3 shrink-0" />
                  {profile.current_company}
                </p>
              ) : null}
            </div>
            {match ? (
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "tabular text-xl font-semibold leading-none",
                    match.score >= 80
                      ? "text-positive-text"
                      : match.score >= 60
                        ? "text-brand-text"
                        : "text-ink-secondary",
                  )}
                >
                  {Math.round(match.score)}%
                </p>
                <p className="text-[10.5px] uppercase tracking-wide text-ink-tertiary">match</p>
              </div>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-tertiary">
            {profile.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {profile.location}
              </span>
            ) : null}
            {profile.experience_years ? <span>{profile.experience_years} yrs experience</span> : null}
            {profile.availability_hint ? (
              <Badge tone={profile.availability_hint === "not_looking" ? "neutral" : "positive"}>
                {AVAILABILITY_LABEL[profile.availability_hint] ?? humanise(profile.availability_hint)}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {profile.summary ? (
        <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-ink-secondary">
          {profile.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        {profile.skills.slice(0, 6).map((skill) => (
          <SkillChip key={skill} matched={match?.matched_skills.includes(skill)}>
            {skill}
          </SkillChip>
        ))}
      </div>

      {match && match.missing_skills.length > 0 ? (
        <p className="mt-2.5 text-[11.5px] text-ink-tertiary">
          Missing: {match.missing_skills.join(", ")}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
        {profile.candidate_id ? (
          <Button variant="secondary" size="sm" asChild className="flex-1">
            <Link href={`/candidates/${profile.candidate_id}`}>View profile</Link>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onToggle(!selected)}
          >
            {selected ? "Deselect" : "Select"}
          </Button>
        )}
        {onOutreach ? (
          <Button variant="primary" size="sm" className="flex-1" onClick={onOutreach}>
            <PhoneOutgoing />
            Start outreach
          </Button>
        ) : null}
        {profile.linkedin_url ? (
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open ${profile.full_name}'s profile`}
            >
              <ExternalLink />
            </a>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export { AVAILABILITY_LABEL };
