"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ownerListPushSubscriptionsAction,
  ownerSendTestPushAction,
} from "@/app/dashboard/push-actions";
import { fmtDateTime } from "@/lib/format";
import { PLATFORM_TZ } from "@/lib/locale";

type DiagSub = {
  id: string;
  userAgent: string;
  endpointHost: string;
  lastSeenAt: string;
  failureCount: number;
  createdAt: string;
  staffId: string | null;
};

export function OwnerPushDiagnostics({ techId }: { techId: string }) {
  const [subs, setSubs] = useState<DiagSub[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      const list = await ownerListPushSubscriptionsAction(techId);
      setSubs(list);
    });
  };

  useEffect(() => {
    let cancelled = false;
    ownerListPushSubscriptionsAction(techId).then((list) => {
      if (!cancelled) setSubs(list);
    });
    return () => {
      cancelled = true;
    };
  }, [techId]);

  const sendTest = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await ownerSendTestPushAction(techId);
      if (!result.ok) {
        setError(result.error ?? "Test failed.");
        return;
      }
      setMessage(`Test sent to ${result.sent} device${result.sent === 1 ? "" : "s"}.`);
      reload();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push diagnostics</CardTitle>
        <CardDescription>
          Registered web-push subscriptions for this salon. Endpoint host and failure count only —
          full endpoints stay server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {subs === null ? (
          <p className="text-ink-faint">Loading…</p>
        ) : subs.length === 0 ? (
          <p className="text-ink-faint">No push subscriptions registered.</p>
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => (
              <li key={s.id} className="rounded-lg border border-edge px-3 py-2">
                <span className="font-medium">{s.endpointHost}</span>
                <span className="text-ink-faint">
                  {" "}
                  · last seen {fmtDateTime(s.lastSeenAt, PLATFORM_TZ)} · failures {s.failureCount}
                  {s.staffId ? " · staff device" : " · owner device"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">{s.userAgent || "—"}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={sendTest} disabled={pending}>
            Send test notification
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reload} disabled={pending}>
            Refresh
          </Button>
        </div>
        {message && <p className="text-success-text">{message}</p>}
        {error && <p className="text-danger-text">{error}</p>}
      </CardContent>
    </Card>
  );
}
