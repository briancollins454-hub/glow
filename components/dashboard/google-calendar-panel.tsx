"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import type { Tech } from "@/lib/db/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { disconnectGoogleCalendarAction } from "@/app/dashboard/actions";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";

type SyncedEvent = {
  bookingId: string;
  summary: string;
  htmlLink: string | null;
  startLocal: string;
};

type SyncResult = {
  synced: number;
  failed: number;
  skipped: number;
  upcoming?: number;
  errors?: string[];
  googleEmail?: string | null;
  calendarName?: string | null;
  calendarId?: string | null;
  events?: SyncedEvent[];
  error?: string;
};

function syncMessage(result: SyncResult): { tone: "ok" | "warn" | "error"; text: string } {
  if (result.error) {
    return { tone: "error", text: result.error };
  }

  const detail =
    result.errors && result.errors.length > 0 ? ` Details: ${result.errors.join(" · ")}` : "";
  const where = [
    result.googleEmail ? `account ${result.googleEmail}` : null,
    result.calendarName ? `calendar “${result.calendarName}”` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const whereHint = where ? ` Sent to ${where}.` : "";

  if (result.failed > 0) {
    return {
      tone: "warn",
      text: `Synced ${result.synced}, but ${result.failed} failed.${detail}${whereHint} Try Disconnect → Connect Google Calendar, then sync again.`,
    };
  }

  if ((result.upcoming ?? 0) === 0 || (result.synced === 0 && result.failed === 0 && result.skipped === 0)) {
    return {
      tone: "warn",
      text: "No upcoming confirmed appointments found in Glow Calendar. Add the booking under Calendar → Add booking (Clients alone does not create a Google event).",
    };
  }

  if (result.synced === 0 && result.skipped > 0) {
    return {
      tone: "warn",
      text: `Found ${result.upcoming ?? result.skipped} booking(s) but none synced.${detail}${whereHint}`,
    };
  }

  return {
    tone: "ok",
    text: `Synced ${result.synced} appointment${result.synced === 1 ? "" : "s"}.${whereHint} Tap a link below to open it in Google — if the link works but your phone calendar is empty, you are looking at a different Google account.`,
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
      setResult({
        synced: data.synced,
        failed: data.failed,
        skipped: data.skipped,
        upcoming: data.upcoming,
        errors: data.errors,
        googleEmail: data.googleEmail,
        calendarName: data.calendarName,
        calendarId: data.calendarId,
        events: data.events,
      });
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
      <p className="text-sm text-success-text">
        Connected{tech.googleCalendarEmail ? ` to ${tech.googleCalendarEmail}` : ""}.
      </p>

      {feedback && (
        <div
          className={`flex flex-col gap-2 rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "ok"
              ? "bg-success-soft text-success-text"
              : feedback.tone === "error"
                ? "bg-danger-soft text-danger-text"
                : "bg-warning-soft text-warning-text"
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.tone === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          {result?.events && result.events.length > 0 && (
            <ul className="space-y-1.5 pl-6">
              {result.events.map((event) => (
                <li key={event.bookingId} className="text-xs">
                  {event.htmlLink ? (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-90"
                    >
                      {event.summary} · {event.startLocal}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>
                      {event.summary} · {event.startLocal}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
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
        Events go to the Google account shown above. After sync, use the links to open them in Google.
        If the link opens but your phone calendar is empty, switch Google account on the phone.
      </p>
    </div>
  );
}
