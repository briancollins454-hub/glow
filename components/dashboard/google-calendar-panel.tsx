"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import type { Tech } from "@/lib/db/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { disconnectGoogleCalendarAction } from "@/app/dashboard/actions";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";

type SyncResult = {
  synced: number;
  failed: number;
  skipped: number;
  error?: string;
};

function syncMessage(result: SyncResult): { tone: "ok" | "warn" | "error"; text: string } {
  if (result.error) {
    return { tone: "error", text: result.error };
  }
  if (result.failed > 0) {
    return {
      tone: "warn",
      text: `Synced ${result.synced} appointment${result.synced === 1 ? "" : "s"}, but ${result.failed} failed. Try again or open a booking and tap Send to Google Calendar.`,
    };
  }
  if (result.synced === 0) {
    return {
      tone: "warn",
      text: "No upcoming confirmed appointments found. Add the booking in Calendar first — adding a client alone does not create a Google event.",
    };
  }
  return {
    tone: "ok",
    text: `Synced ${result.synced} appointment${result.synced === 1 ? "" : "s"} to Google Calendar.`,
  };
}

export function GoogleCalendarPanel({ tech }: { tech: Tech }) {
  const googleConnected = !!tech.googleRefreshToken && !!tech.googleCalendarId;
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/google/calendar/sync", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as SyncResult & { ok?: boolean; error?: string };
      if (!res.ok) {
        setResult({
          synced: 0,
          failed: 0,
          skipped: 0,
          error:
            data.error === "not_connected"
              ? "Google Calendar is not connected on the server yet. Refresh the page, or disconnect and reconnect."
              : data.error ?? "Sync failed. Please try again.",
        });
        return;
      }
      setResult({ synced: data.synced, failed: data.failed, skipped: data.skipped });
      invalidateDashboardAuth();
    } catch {
      setResult({
        synced: 0,
        failed: 0,
        skipped: 0,
        error: "Network error — check your connection and try again.",
      });
    } finally {
      setSyncing(false);
    }
  }

  if (!googleConnected) {
    return <ButtonLink href="/api/google/calendar/connect" size="lg">Connect Google Calendar</ButtonLink>;
  }

  const feedback = result ? syncMessage(result) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-emerald-300">
        Connected{tech.googleCalendarEmail ? ` to ${tech.googleCalendarEmail}` : ""}.
      </p>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "ok"
              ? "bg-emerald-500/10 text-emerald-300"
              : feedback.tone === "error"
                ? "bg-red-500/10 text-red-300"
                : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {feedback.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={syncing}
          onClick={handleSync}
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Syncing…
            </>
          ) : (
            "Sync appointments to Google"
          )}
        </Button>
        <form action={disconnectGoogleCalendarAction}>
          <Button type="submit" variant="outline" size="sm" disabled={syncing}>
            Disconnect
          </Button>
        </form>
      </div>
      <p className="text-xs text-ink-faint">
        Sync pushes all upcoming confirmed bookings. Adding a client in Clients does not create a calendar event — add the appointment in Calendar.
      </p>
    </div>
  );
}
