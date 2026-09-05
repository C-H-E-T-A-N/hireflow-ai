"use client";

import { MessagesSquare, Mic, PhoneOutgoing } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PageHeader } from "@/components/shell/app-shell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { query } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationListItem, ListResponse } from "@/types/api";

const SENTIMENT_TONE = {
  positive: "positive",
  neutral: "neutral",
  negative: "danger",
} as const;

export default function ConversationsPage() {
  const [channel, setChannel] = React.useState("all");

  const path = `/conversations${query({
    channel: channel === "all" ? undefined : channel,
    limit: 100,
  })}`;
  const { data, error, isLoading, refresh } = useApi<ListResponse<ConversationListItem>>(path, {
    refreshInterval: 15000,
  });

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Every AI voice conversation, with its transcript, extracted answers and summary."
      />

      <Tabs value={channel} onValueChange={setChannel} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="voice_outreach">Outreach</TabsTrigger>
          <TabsTrigger value="voice_interview">Interviews</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} columns={3} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : data && data.items.length > 0 ? (
          <div className="divide-y divide-line">
            {data.items.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
              >
                <span
                  className={
                    conversation.channel === "voice_interview"
                      ? "flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-soft-border bg-brand-soft text-brand-text"
                      : "flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-secondary"
                  }
                >
                  {conversation.channel === "voice_interview" ? (
                    <Mic className="size-4" />
                  ) : (
                    <PhoneOutgoing className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand-text">
                    {conversation.title ?? "Conversation"}
                  </p>
                  {conversation.summary ? (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-secondary">
                      {conversation.summary}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12.5px] italic text-ink-tertiary">
                      No summary generated yet.
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-tertiary">
                    <span>{conversation.turn_count} turns</span>
                    <span>·</span>
                    <span>{formatRelativeTime(conversation.created_at)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={conversation.status} />
                  {conversation.sentiment ? (
                    <Badge
                      tone={
                        SENTIMENT_TONE[conversation.sentiment as keyof typeof SENTIMENT_TONE] ??
                        "neutral"
                      }
                    >
                      {conversation.sentiment}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<MessagesSquare />}
            title="No conversations yet"
            description="Voice conversations appear here after an AI outreach call or interview runs."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/outreach">Start an outreach call</Link>
              </Button>
            }
          />
        )}
      </Card>
    </>
  );
}
