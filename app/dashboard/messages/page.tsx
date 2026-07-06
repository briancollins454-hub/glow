"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Client, Message } from "@/lib/db/types";

type MessagesData =
  | { live: false }
  | { live: true; clients: Client[]; messages: Message[] };

export default function MessagesPage() {
  return (
    <AsyncDashboardPage<MessagesData> pageKey="messages">
      {(data) => <MessagesView {...data} />}
    </AsyncDashboardPage>
  );
}

function MessagesView(data: MessagesData) {
  if (!data.live) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-ink-soft">Chat with clients in one place - they reply from a private link, no app needed.</p>
        </div>
        <UpgradePrompt feature="Client messaging" />
      </div>
    );
  }

  const { clients, messages } = data;
  const clientById = Object.fromEntries(clients.map((cl) => [cl.id, cl]));
  const latest = new Map<string, Message>();
  const unread = new Map<string, number>();
  for (const m of messages) {
    if (!latest.has(m.clientId)) latest.set(m.clientId, m);
    if (m.sender === "client" && !m.readAt) unread.set(m.clientId, (unread.get(m.clientId) ?? 0) + 1);
  }
  const threads = [...latest.entries()]
    .map(([clientId, last]) => ({ client: clientById[clientId], last, unread: unread.get(clientId) ?? 0 }))
    .filter((t) => t.client)
    .sort((a, b) => (a.last.createdAt < b.last.createdAt ? 1 : -1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-ink-soft">Chat with clients in one place - they reply from a private link, no app needed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversations ({threads.length})</CardTitle>
          <CardDescription>Start a new chat from any client&apos;s profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {threads.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="h-6 w-6 text-ink-faint" />
              <p className="text-sm text-ink-faint">No conversations yet.</p>
              <Link href="/dashboard/clients" className="text-sm font-medium text-brand-300">Message a client →</Link>
            </div>
          )}
          {threads.map((t) => (
            <Link
              key={t.client!.id}
              href={`/dashboard/messages/${t.client!.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3 transition hover:shadow-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.client!.name}</span>
                  {t.unread > 0 && <Badge tone="red">{t.unread} new</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {t.last.sender === "tech" ? "You: " : ""}
                  {t.last.body}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
