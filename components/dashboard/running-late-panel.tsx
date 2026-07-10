"use client";

import { useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { runningLateCascadeAction } from "@/app/dashboard/actions";

const PRESETS = [10, 15, 20, 30, 45];

export function RunningLatePanel({
  targetCount,
  compact = false,
  returnTo = "/dashboard/bookings",
}: {
  /** How many clients will be notified (remaining appointments today). */
  targetCount: number;
  compact?: boolean;
  returnTo?: string;
}) {
  const [minutes, setMinutes] = useState(15);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (targetCount === 0) return null;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          : "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Running late?</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Notify {targetCount} client{targetCount === 1 ? "" : "s"} with appointments still to come today
            by email and SMS.
          </p>
        </div>
      </div>

      <form action={runningLateCascadeAction} className="mt-3 space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <Label>How late? (minutes)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (minutes === m
                    ? "bg-amber-600 text-white"
                    : "bg-white/[0.06] text-ink-soft hover:text-ink")
                }
              >
                {m} min
              </button>
            ))}
          </div>
          <Input
            name="minutesLate"
            type="number"
            min={1}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 15)}
            className="mt-2 w-28"
          />
        </div>
        <div>
          <Label htmlFor="late-note">Optional note</Label>
          <Textarea
            id="late-note"
            name="note"
            rows={2}
            placeholder="e.g. Stuck in traffic, should be with you soon"
          />
        </div>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
          >
            Notify today&apos;s clients
          </button>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="flex items-start gap-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This emails and texts every client with an appointment still to come today (~{minutes} min late).
              Continue?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SubmitButton
                size="sm"
                pendingLabel="Sending…"
                className="bg-amber-600 hover:bg-amber-500"
              >
                Yes, notify them
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-edge px-3 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
