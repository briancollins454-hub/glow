"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { statusBadge } from "@/components/dashboard/status";
import { fmtDate, fmtTime, gbp } from "@/lib/format";
import { dateStrInTz } from "@/lib/rules";
import type { Booking } from "@/lib/db/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Props = {
  bookings: Booking[];
  clientById: Record<string, string>;
  serviceById: Record<string, string>;
  /** Controlled selected day (YYYY-MM-DD London). */
  selected?: string;
  onSelectedChange?: (dateStr: string) => void;
  /** Hide the flat day list (e.g. when team columns are shown instead). */
  hideDayList?: boolean;
};

function activeBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.status !== "cancelled");
}

function bookingsByDate(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>();
  for (const b of activeBookings(bookings)) {
    const key = dateStrInTz(new Date(b.startIso));
    const list = map.get(key);
    if (list) list.push(b);
    else map.set(key, [b]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startIso.localeCompare(b.startIso));
  }
  return map;
}

function monthCells(cursor: Date): { dateStr: string; inMonth: boolean }[] {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const days = eachDayOfInterval({ start, end });
  // UK weeks start Monday: getDay Sun=0 … Sat=6 → Mon=0
  const pad = (getDay(start) + 6) % 7;
  const cells: { dateStr: string; inMonth: boolean }[] = [];
  for (let i = 0; i < pad; i++) {
    cells.push({ dateStr: "", inMonth: false });
  }
  for (const d of days) {
    cells.push({ dateStr: dateStrInTz(d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateStr: "", inMonth: false });
  }
  return cells;
}

export function BookingsMonthCalendar({
  bookings,
  clientById,
  serviceById,
  selected: selectedProp,
  onSelectedChange,
  hideDayList = false,
}: Props) {
  const todayStr = dateStrInTz(new Date());
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [internalSelected, setInternalSelected] = useState(todayStr);
  const selected = selectedProp ?? internalSelected;
  const setSelected = (dateStr: string) => {
    if (onSelectedChange) onSelectedChange(dateStr);
    else setInternalSelected(dateStr);
  };

  const byDate = useMemo(() => bookingsByDate(bookings), [bookings]);
  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const selectedBookings = byDate.get(selected) ?? [];
  const monthLabel = format(cursor, "MMMM yyyy");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Month view</CardTitle>
            <CardDescription>Tap a day to see what&apos;s booked.</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor((c) => startOfMonth(addMonths(c, -1)))}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[8.5rem] text-center text-sm font-medium text-ink">{monthLabel}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor((c) => startOfMonth(addMonths(c, 1)))}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div className="grid min-w-0 grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:text-xs">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell.inMonth || !cell.dateStr) {
              return <div key={`pad-${i}`} className="min-h-14 rounded-lg sm:min-h-16" />;
            }
            const dayBookings = byDate.get(cell.dateStr) ?? [];
            const count = dayBookings.length;
            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selected;
            const dayNum = Number(cell.dateStr.slice(8, 10));
            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelected(cell.dateStr)}
                className={[
                  "flex min-h-14 flex-col items-center justify-start gap-1 rounded-lg px-1 py-1.5 text-sm transition sm:min-h-16",
                  isSelected
                    ? "bg-brand-500/20 ring-1 ring-brand-400/50"
                    : "hover:bg-fill-hover",
                  isToday && !isSelected ? "ring-1 ring-edge" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-7 w-7 place-items-center rounded-full text-sm font-medium",
                    isToday ? "bg-brand-500 text-white" : "text-ink",
                  ].join(" ")}
                >
                  {dayNum}
                </span>
                {count > 0 ? (
                  <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-text">
                    {count}
                  </span>
                ) : (
                  <span className="h-[18px]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        {!hideDayList && (
          <div className="border-t border-edge pt-4">
            <p className="mb-2 text-sm font-medium text-ink">
              {fmtDate(`${selected}T12:00:00Z`)}
              <span className="ml-2 font-normal text-ink-faint">
                ({selectedBookings.length} booking{selectedBookings.length === 1 ? "" : "s"})
              </span>
            </p>
            {selectedBookings.length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-faint">Nothing booked this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedBookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-cream px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/dashboard/bookings/${b.id}`}
                          className="truncate font-medium hover:text-brand-text"
                        >
                          {clientById[b.clientId] ?? "Client"}
                        </Link>
                        {statusBadge(b.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {fmtTime(b.startIso)} · {serviceById[b.serviceId] ?? "Service"} ·{" "}
                        <span className="font-medium text-ink">{gbp(b.pricePennies)}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      <BookingActions id={b.id} status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {hideDayList && (
          <p className="border-t border-edge pt-3 text-xs text-ink-faint">
            Selected day opens in the team columns below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
