"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ALL_DAY_TIMES: { time: string }[] = (() => {
  const out: { time: string }[] = [];
  for (let h = 0; h < 24; h++)
    for (const m of [0, 15, 30, 45]) out.push({ time: `${pad(h)}:${pad(m)}` });
  return out;
})();

export type TimeSlotOption = {
  time: string;
  /** Client initial when this start is already taken. */
  takenInitial?: string;
  takenName?: string;
};

/**
 * Month-grid calendar + time picker. Submits as a hidden input in
 * datetime-local format (YYYY-MM-DDTHH:mm) under `name`.
 *
 * Pass `timesForDate` to offer in-hours slots (free + taken). Taken times are
 * greyed with the client's initial; selecting one requires an explicit
 * "Book anyway" confirmation before submit.
 */
export function DateTimePicker({
  name,
  defaultValue,
  timesForDate,
  emptyTimesHint = "No free times on this day",
  overbookConfirmLabel,
}: {
  name: string;
  /** datetime-local format, e.g. 2026-07-03T12:30 */
  defaultValue?: string;
  /** When set, only these HH:mm values are offered for the selected date. */
  timesForDate?: (dateStr: string) => TimeSlotOption[];
  emptyTimesHint?: string;
  /** Override the overbook confirmation copy. Receives client name + time. */
  overbookConfirmLabel?: (clientName: string, time: string) => string;
}) {
  const now = new Date();
  const initialDate = defaultValue ? defaultValue.slice(0, 10) : "";
  const initialTime = defaultValue ? defaultValue.slice(11, 16) : "10:00";

  const [selected, setSelected] = useState<string>(initialDate);
  const [time, setTime] = useState<string>(initialTime);
  const [confirmOverbook, setConfirmOverbook] = useState(false);
  const [viewYear, setViewYear] = useState<number>(
    initialDate ? parseInt(initialDate.slice(0, 4), 10) : now.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState<number>(
    initialDate ? parseInt(initialDate.slice(5, 7), 10) - 1 : now.getMonth(),
  );

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(viewYear, viewMonth, d));
    return out;
  }, [viewYear, viewMonth]);

  const todayKey = dateKey(now);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  const options = useMemo(() => {
    if (!timesForDate) return ALL_DAY_TIMES;
    if (!selected) return [];
    return timesForDate(selected);
  }, [timesForDate, selected]);

  const selectedOption = options.find((o) => o.time === time) ?? null;
  const isTaken = Boolean(selectedOption?.takenInitial || selectedOption?.takenName);

  // Keep the selected time inside the allowed list for the chosen day.
  useEffect(() => {
    if (!timesForDate || !selected) return;
    if (options.length === 0) {
      if (time) setTime("");
      return;
    }
    if (!options.some((o) => o.time === time)) setTime(options[0]!.time);
  }, [timesForDate, selected, options, time]);

  useEffect(() => {
    if (!isTaken) setConfirmOverbook(false);
  }, [isTaken, time, selected]);

  const valueReady = Boolean(
    selected && time && (!timesForDate || options.some((o) => o.time === time)),
  );

  const confirmCopy =
    isTaken && selectedOption
      ? (overbookConfirmLabel?.(
          selectedOption.takenName || "another client",
          selectedOption.time,
        ) ??
        `This slot is taken by ${selectedOption.takenName || "another client"} at ${selectedOption.time}. Book anyway?`)
      : "";

  return (
    <div className="rounded-xl border border-edge bg-fill p-3">
      <input
        type="hidden"
        name={name}
        value={valueReady ? `${selected}T${time}` : ""}
        required
      />
      {isTaken && confirmOverbook && (
        <input type="hidden" name="confirmOverbook" value="1" />
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{MONTHS[viewMonth]} {viewYear}</p>
        <button type="button" onClick={nextMonth} className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-ink-faint">
        {WEEKDAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const key = dateKey(d);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "grid h-10 place-items-center rounded-lg text-sm transition",
                isSelected
                  ? "bg-brand-600 font-semibold text-white"
                  : isToday
                    ? "border border-brand-500/50 text-brand-text hover:bg-fill-hover"
                    : "text-ink hover:bg-fill-hover",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-edge pt-3">
        <span className="text-sm text-ink-soft">Time</span>
        {timesForDate && !selected ? (
          <span className="text-sm text-ink-faint">Pick a date first</span>
        ) : timesForDate && options.length === 0 ? (
          <span className="text-sm text-warning-text">{emptyTimesHint}</span>
        ) : (
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="input h-10 min-w-[7rem] cursor-pointer"
            disabled={options.length === 0}
          >
            {options.map((o) => (
              <option
                key={o.time}
                value={o.time}
                className={o.takenInitial ? "text-ink-faint" : undefined}
              >
                {o.takenInitial ? `${o.time} · ${o.takenInitial}` : o.time}
              </option>
            ))}
          </select>
        )}
        {valueReady ? (
          <span className="ml-auto text-sm font-medium text-brand-text">
            {new Date(`${selected}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {time}
            {isTaken && selectedOption?.takenInitial ? (
              <span className="ml-1 text-ink-faint">({selectedOption.takenInitial})</span>
            ) : null}
          </span>
        ) : (
          <span className="ml-auto text-sm text-ink-faint">Pick a date</span>
        )}
      </div>

      {isTaken && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm text-warning-text">{confirmCopy}</p>
          <label className="mt-2 flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={confirmOverbook}
              onChange={(e) => setConfirmOverbook(e.target.checked)}
              className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
            />
            Yes, book anyway
          </label>
        </div>
      )}
    </div>
  );
}
