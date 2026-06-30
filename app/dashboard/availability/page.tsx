import { CheckCircle2, Trash2, CalendarOff } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentTech } from "@/lib/auth/session";
import { listTimeOff, listWorkingHours } from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import {
  saveAvailabilityAction,
  addTimeOffAction,
  deleteTimeOffAction,
} from "../actions";

const DAYS: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

function minToHHMM(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");
  const { saved } = await searchParams;
  const hours = listWorkingHours(tech.id);
  const offs = listTimeOff(tech.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Availability</h1>
        <p className="text-sm text-ink-soft">
          Your weekly hours and any time off. Slots are generated from this
          automatically (Europe/London).
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Availability saved.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
          <CardDescription>Toggle a day off, or set your start and end times.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAvailabilityAction} className="space-y-3">
            {DAYS.map(({ weekday, label }) => {
              const row = hours.find((h) => h.weekday === weekday);
              const enabled = row?.enabled ?? false;
              return (
                <div
                  key={weekday}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-cream px-4 py-3"
                >
                  <label className="flex w-36 items-center gap-2.5">
                    <input
                      type="checkbox"
                      name={`enabled_${weekday}`}
                      defaultChecked={enabled}
                      className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                  <div className="flex items-center gap-2 text-sm text-ink-soft">
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
                  </div>
                </div>
              );
            })}
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
                  className="flex items-center justify-between rounded-xl border border-black/5 bg-cream px-4 py-3"
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
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-red-50 hover:text-red-600"
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
            className="grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
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
