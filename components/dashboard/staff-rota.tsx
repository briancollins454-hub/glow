"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearStaffRotaWeekAction,
  copyStaffRotaFromPreviousAction,
  loadStaffRotaWeekAction,
  saveStaffRotaWeekAction,
} from "@/app/dashboard/team/actions";
import {
  addDaysToDateStr,
  currentWeekStartLondon,
  formatWeekLabel,
} from "@/lib/rota";
import type { RotaHour, WorkingHour } from "@/lib/db/types";

const DAYS = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

type DayDraft = {
  enabled: boolean;
  start: string;
  end: string;
};

function draftsFromRows(rows: RotaHour[], fallback: WorkingHour[]): DayDraft[] {
  return DAYS.map(({ weekday }) => {
    const row = rows.find((r) => r.weekday === weekday);
    if (row) {
      return {
        enabled: row.enabled,
        start: minToHHMM(row.startMinutes),
        end: minToHHMM(row.endMinutes),
      };
    }
    const fb = fallback.find((h) => h.weekday === weekday);
    return {
      enabled: fb?.enabled ?? false,
      start: minToHHMM(fb?.startMinutes ?? 540),
      end: minToHHMM(fb?.endMinutes ?? 1020),
    };
  });
}

export function StaffRotaEditor({
  staffId,
  templateHours,
}: {
  staffId: string;
  templateHours: WorkingHour[];
}) {
  const [weekStart, setWeekStart] = useState(currentWeekStartLondon);
  const [drafts, setDrafts] = useState<DayDraft[]>(() => draftsFromRows([], templateHours));
  const [hasSavedWeek, setHasSavedWeek] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      setMessage(null);
      const rows = await loadStaffRotaWeekAction(staffId, weekStart);
      if (cancelled) return;
      setHasSavedWeek(rows.length > 0);
      setDrafts(draftsFromRows(rows, templateHours));
    });
    return () => {
      cancelled = true;
    };
    // templateHours is only a fallback when the week has no rota yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, weekStart]);

  function updateDay(index: number, patch: Partial<DayDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function save() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", staffId);
      fd.set("weekStart", weekStart);
      DAYS.forEach(({ weekday }, i) => {
        if (drafts[i]?.enabled) fd.set(`enabled_${weekday}`, "on");
        fd.set(`start_${weekday}`, drafts[i]?.start ?? "09:00");
        fd.set(`end_${weekday}`, drafts[i]?.end ?? "17:00");
      });
      const res = await saveStaffRotaWeekAction(fd);
      if (res.ok) {
        setHasSavedWeek(true);
        setMessage("Rota week saved. Online booking will use these hours.");
      } else {
        setMessage(res.error);
      }
    });
  }

  function clearWeek() {
    startTransition(async () => {
      const res = await clearStaffRotaWeekAction(staffId, weekStart);
      if (res.ok) {
        setHasSavedWeek(false);
        setDrafts(draftsFromRows([], templateHours));
        setMessage("Cleared. This week falls back to usual / flexible hours.");
      } else {
        setMessage(res.error);
      }
    });
  }

  function copyPrevious() {
    startTransition(async () => {
      const res = await copyStaffRotaFromPreviousAction(staffId, weekStart);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setHasSavedWeek(res.rows.length > 0);
      setDrafts(draftsFromRows(res.rows, templateHours));
      setMessage(
        res.rows.length
          ? "Copied previous week into this week."
          : "Previous week has no rota saved.",
      );
    });
  }

  return (
    <div className="space-y-3 border-t border-edge p-4">
      <p className="text-sm text-ink-soft">
        Set this person&apos;s real days and times for a specific week. Weeks with a saved rota
        override the usual hours (and flexible daily window) for online booking.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setWeekStart(addDaysToDateStr(weekStart, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[10rem] text-center text-sm font-medium text-ink">
          Week of {formatWeekLabel(weekStart)}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setWeekStart(addDaysToDateStr(weekStart, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setWeekStart(currentWeekStartLondon())}
        >
          This week
        </Button>
        {hasSavedWeek ? (
          <span className="rounded-lg bg-success-soft px-2 py-1 text-xs text-success-text">
            Rota saved
          </span>
        ) : (
          <span className="rounded-lg bg-fill-hover px-2 py-1 text-xs text-ink-faint">
            Using usual hours
          </span>
        )}
      </div>

      <div className="space-y-2">
        {DAYS.map(({ weekday, label }, i) => {
          const day = drafts[i]!;
          return (
            <div
              key={weekday}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
            >
              <label className="flex w-36 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(i, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
                />
                <span className="font-medium">{label}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <input
                  type="time"
                  value={day.start}
                  disabled={!day.enabled}
                  onChange={(e) => updateDay(i, { start: e.target.value })}
                  className="input h-10 w-32"
                />
                <span>to</span>
                <input
                  type="time"
                  value={day.end}
                  disabled={!day.enabled}
                  onChange={(e) => updateDay(i, { end: e.target.value })}
                  className="input h-10 w-32"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={save}>
          Save rota week
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={copyPrevious}>
          Copy previous week
        </Button>
        {hasSavedWeek && (
          <Button type="button" variant="secondary" disabled={pending} onClick={clearWeek}>
            Clear this week
          </Button>
        )}
      </div>

      {message && <p className="text-sm text-ink-soft">{message}</p>}
    </div>
  );
}
