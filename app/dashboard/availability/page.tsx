"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Trash2, CalendarOff } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import { saveAvailabilityAction, addTimeOffAction, deleteTimeOffAction } from "../actions";
import type { ApprovalMode, TimeOff, WorkingHour } from "@/lib/db/types";

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

type AvailabilityData = {
  hours: WorkingHour[];
  offs: TimeOff[];
  flexibleHoursEnabled: boolean;
  flexibleStartMinutes: number;
  flexibleEndMinutes: number;
  flexibleLastStartMinutes: number | null;
  approvalMode: ApprovalMode;
};

export default function AvailabilityPage() {
  return (
    <AsyncDashboardPage<AvailabilityData> pageKey="availability">
      {(data) => <AvailabilityView {...data} />}
    </AsyncDashboardPage>
  );
}

function AvailabilityView({
  hours,
  offs,
  flexibleHoursEnabled: initialFlexible,
  flexibleStartMinutes,
  flexibleEndMinutes,
  flexibleLastStartMinutes,
  approvalMode,
}: AvailabilityData) {
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved");
  const [flexible, setFlexible] = useState(initialFlexible);
  const approvalOn = approvalMode === "manual" || approvalMode === "rules";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Opening hours</h1>
        <p className="text-sm text-ink-soft">
          Your weekly hours and any time off. Slots are generated from this automatically (Europe/London).
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Availability saved.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
          <CardDescription>
            Toggle a day off, or set your start and end times. &quot;Last appt&quot; is optional: the latest
            time an appointment can start, even if it runs past closing. Leave it blank to only
            allow appointments that finish by closing time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAvailabilityAction} className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge bg-cream px-4 py-3">
              <input
                type="checkbox"
                name="flexibleHoursEnabled"
                checked={flexible}
                onChange={(e) => setFlexible(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
              />
              <span>
                <span className="block font-medium text-ink">My days change each week</span>
                <span className="mt-0.5 block text-sm text-ink-soft">
                  Offer bookable times every day inside one daily window instead of a fixed Mon-Sun
                  pattern. Use Time off below for days you are closed. Booking approval in Settings
                  lets you accept or decline each request.
                </span>
              </span>
            </label>

            {flexible && !approvalOn && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Tip: turn on <span className="font-medium">Booking approval</span> in Settings so
                clients can request times, and you only confirm the days you are actually working.
              </p>
            )}

            {flexible ? (
              <div className="space-y-3 rounded-xl border border-edge bg-cream px-4 py-3">
                <p className="text-sm font-medium text-ink">Daily window (every day)</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="time"
                    name="flexibleStart"
                    defaultValue={minToHHMM(flexibleStartMinutes)}
                    className="input h-10 w-32"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    name="flexibleEnd"
                    defaultValue={minToHHMM(flexibleEndMinutes)}
                    className="input h-10 w-32"
                  />
                  <span className="text-xs text-ink-faint">last appt</span>
                  <input
                    type="time"
                    name="flexibleLast"
                    defaultValue={
                      flexibleLastStartMinutes != null ? minToHHMM(flexibleLastStartMinutes) : ""
                    }
                    className="input h-10 w-32"
                  />
                </div>
                <p className="text-xs text-ink-faint">
                  Your fixed weekly hours below are kept for when you turn this off.
                </p>
              </div>
            ) : null}

            <div className={flexible ? "space-y-3 opacity-60" : "space-y-3"}>
              {flexible && (
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Saved weekly hours (not used while flexible mode is on)
                </p>
              )}
              {DAYS.map(({ weekday, label }) => {
                const row = hours.find((h) => h.weekday === weekday);
                return (
                  <div
                    key={weekday}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
                  >
                    <label className="flex w-36 items-center gap-2.5">
                      <input
                        type="checkbox"
                        name={`enabled_${weekday}`}
                        defaultChecked={row?.enabled ?? false}
                        className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
                      />
                      <span className="font-medium">{label}</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="time"
                        name={`start_${weekday}`}
                        defaultValue={minToHHMM(row?.startMinutes ?? 540)}
                        className="input h-10 w-32"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        name={`end_${weekday}`}
                        defaultValue={minToHHMM(row?.endMinutes ?? 1020)}
                        className="input h-10 w-32"
                      />
                      <span className="text-xs text-ink-faint">last appt</span>
                      <input
                        type="time"
                        name={`last_${weekday}`}
                        defaultValue={
                          row?.lastStartMinutes != null ? minToHHMM(row.lastStartMinutes) : ""
                        }
                        className="input h-10 w-32"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit">Save hours</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time off</CardTitle>
          <CardDescription>Block out holidays, training days or breaks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offs.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-faint">
              <CalendarOff className="h-4 w-4" /> No time off scheduled.
            </p>
          ) : (
            <ul className="space-y-2">
              {offs.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-edge bg-cream px-4 py-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {fmtDateTime(o.startIso)} → {fmtDateTime(o.endIso)}
                    </p>
                    {o.reason && <p className="text-ink-faint">{o.reason}</p>}
                  </div>
                  <form action={deleteTimeOffAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button
                      type="submit"
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={addTimeOffAction}
            className="grid gap-3 border-t border-edge pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="start">From</Label>
              <Input id="start" name="start" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="end">To</Label>
              <Input id="end" name="end" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" name="reason" placeholder="Holiday" />
            </div>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
