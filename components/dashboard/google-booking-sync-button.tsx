"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleBookingSyncButton({
  bookingId,
  hasGoogleEvent,
}: {
  bookingId: string;
  hasGoogleEvent: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/google/calendar/sync-booking", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage({
          tone: "error",
          text: data.error ?? "Could not sync to Google Calendar. Try Settings → Sync appointments.",
        });
        return;
      }
      setMessage({ tone: "ok", text: "Sent to Google Calendar." });
    } catch {
      setMessage({ tone: "error", text: "Network error — try again." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            message.tone === "ok" ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text"
          }`}
        >
          {message.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          {message.text}
        </div>
      )}
      <p className="text-sm text-ink-soft">
        {hasGoogleEvent
          ? "This booking is linked to Google Calendar. Sync again if the event looks wrong or is missing."
          : "This booking has not been sent to Google Calendar yet."}
      </p>
      <Button type="button" variant="secondary" size="sm" disabled={syncing} onClick={handleSync}>
        {syncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Syncing…
          </>
        ) : (
          "Send to Google Calendar"
        )}
      </Button>
    </div>
  );
}
