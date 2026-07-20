"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label } from "@/components/ui/input";
import { addTimeOffAction, deleteTimeOffAction } from "@/app/dashboard/actions";
import { timeOffOnDate } from "@/lib/booking/staff-day";
import { fmtTime } from "@/lib/format";
import type { StaffMember, TimeOff } from "@/lib/db/types";

function localDateTime(dateStr: string, hour: number, minute = 0): string {
  return `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function BlockTimeForm({
  dateStr,
  offs,
  staff,
}: {
  dateStr: string;
  offs: TimeOff[];
  staff: StaffMember[];
}) {
  const dayOffs = useMemo(() => timeOffOnDate(offs, dateStr), [offs, dateStr]);
  const showStaff = staff.length > 1;
  const [start, setStart] = useState(() => localDateTime(dateStr, 12));
  const [end, setEnd] = useState(() => localDateTime(dateStr, 13));
  const [everyone, setEveryone] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(() =>
    staff[0]?.id ? [staff[0].id] : [],
  );

  // Keep defaults on the selected calendar day when the user changes day.
  useEffect(() => {
    setStart(localDateTime(dateStr, 12));
    setEnd(localDateTime(dateStr, 13));
  }, [dateStr]);

  const staffName = (id: string | null | undefined) =>
    id ? staff.find((s) => s.id === id)?.name ?? "Team" : "Everyone";

  const toggleStaff = (id: string) => {
    setEveryone(false);
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectEveryone = () => {
    setEveryone(true);
    setSelectedStaffIds([]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Block a one-off gap (doctor&apos;s appointment, lunch, training). Clients can still book around
        it. This is different from a service buffer, which repeats after every booking of that
        treatment.
      </p>

      <form action={addTimeOffAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="returnTo" value="/dashboard/bookings" />
        {showStaff && (
          <div className="sm:col-span-2">
            <Label>Whose diary?</Label>
            <div className="mt-1.5 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="staffIds"
                  value="everyone"
                  checked={everyone}
                  onChange={(e) => {
                    if (e.target.checked) selectEveryone();
                    else setEveryone(false);
                  }}
                  className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
                />
                Everyone (whole salon)
              </label>
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="staffIds"
                    value={s.id}
                    checked={!everyone && selectedStaffIds.includes(s.id)}
                    onChange={() => toggleStaff(s.id)}
                    className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="block-start">From</Label>
          <Input
            id="block-start"
            name="start"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="block-end">To</Label>
          <Input
            id="block-end"
            name="end"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="block-reason">Reason (optional)</Label>
          <Input id="block-reason" name="reason" placeholder="Doctor's appointment" />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-ink-soft hover:bg-white/[0.06]"
            onClick={() => {
              setStart(localDateTime(dateStr, 12));
              setEnd(localDateTime(dateStr, 12, 30));
            }}
          >
            30 mins at 12:00
          </button>
          <button
            type="button"
            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-ink-soft hover:bg-white/[0.06]"
            onClick={() => {
              setStart(localDateTime(dateStr, 12));
              setEnd(localDateTime(dateStr, 13));
            }}
          >
            1 hour at 12:00
          </button>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton variant="secondary" pendingLabel="Blocking…">
            <CalendarOff className="h-4 w-4" /> Block this time
          </SubmitButton>
        </div>
      </form>

      {dayOffs.length > 0 && (
        <div className="space-y-2 border-t border-edge pt-4">
          <p className="text-sm font-medium text-ink">Blocked on this day</p>
          <ul className="space-y-2">
            {dayOffs.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-white/[0.03] px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {fmtTime(o.startIso)} – {fmtTime(o.endIso)}
                    {showStaff ? (
                      <span className="font-normal text-ink-faint"> · {staffName(o.staffId)}</span>
                    ) : null}
                  </p>
                  {o.reason && <p className="text-xs text-ink-faint">{o.reason}</p>}
                </div>
                <form action={deleteTimeOffAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="returnTo" value="/dashboard/bookings" />
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
