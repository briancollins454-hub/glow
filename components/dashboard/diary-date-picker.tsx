"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/format";
import {
  addMonthsToMonthStart,
  firstOfMonthContaining,
  formatDateAriaLabel,
  formatMonthHeading,
  monthGridForMonth,
} from "@/lib/rota";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Date label that opens a month grid popover to jump the diary to any day.
 * Uses existing onDateChange; does not own navigation state.
 */
export function DiaryDatePicker({
  dateStr,
  onDateChange,
  className,
}: {
  dateStr: string;
  onDateChange: (dateStr: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [monthStart, setMonthStart] = useState(() => firstOfMonthContaining(dateStr));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // London today as YYYY-MM-DD
  const todayLondon = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  useEffect(() => {
    if (open) setMonthStart(firstOfMonthContaining(dateStr));
  }, [open, dateStr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  function selectDay(next: string) {
    onDateChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const cells = monthGridForMonth(monthStart);

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 min-w-[9rem] items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink hover:bg-fill-hover"
      >
        <span>{fmtDate(`${dateStr}T12:00:00Z`)}</span>
        <ChevronDown className="h-4 w-4 text-ink-faint" aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          className="absolute left-1/2 z-40 mt-1 w-[min(100vw-2rem,20rem)] -translate-x-1/2 rounded-2xl border border-edge bg-surface p-3 shadow-card"
        >
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthStart((m) => addMonthsToMonthStart(m, -1))}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p id={titleId} className="text-sm font-semibold text-ink">
              {formatMonthHeading(monthStart)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonthStart((m) => addMonthsToMonthStart(m, 1))}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell) => {
              const isToday = cell.dateStr === todayLondon;
              const isSelected = cell.dateStr === dateStr;
              const dayNum = Number(cell.dateStr.slice(8, 10));
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  aria-label={formatDateAriaLabel(cell.dateStr)}
                  aria-current={isSelected ? "date" : undefined}
                  onClick={() => selectDay(cell.dateStr)}
                  className={[
                    "grid h-10 w-full place-items-center rounded-lg text-sm tabular-nums transition",
                    isSelected
                      ? "bg-brand-500/20 font-semibold text-ink ring-1 ring-brand-400/50"
                      : "hover:bg-fill-hover",
                    !cell.inMonth ? "text-ink-faint" : "text-ink",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-8 w-8 place-items-center rounded-full",
                      isToday ? "bg-brand-500 font-semibold text-white" : "",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => selectDay(todayLondon)}
            className="mt-2 w-full rounded-xl border border-edge px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-fill-hover"
          >
            Today
          </button>
        </div>
      ) : null}
    </div>
  );
}
