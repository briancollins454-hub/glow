"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { statusBadge } from "@/components/dashboard/status";
import { fmtDate, fmtTime } from "@/lib/format";
import {
  UNASSIGNED_STAFF_ID,
  activeBookingsOnDate,
  bookingsInColumn,
  dayWindowMinutes,
  minutesFromMidnightLondon,
  packBookingLanes,
  staffColumnsForDay,
  timeOffInColumn,
  timeOffOnDate,
  unavailableRangesForStaffDay,
} from "@/lib/booking/staff-day";
import { addDaysToDateStr } from "@/lib/rota";
import type { Booking, StaffMember, TimeOff, WorkingHour } from "@/lib/db/types";

const PX_PER_MIN = 1.15;
const COL_MIN_WIDTH = 160;
const LANE_GAP_PX = 2;

type Props = {
  dateStr: string;
  onDateChange: (dateStr: string) => void;
  bookings: Booking[];
  staff: StaffMember[];
  clientById: Record<string, string>;
  serviceById: Record<string, string>;
  /** serviceId → cleanup minutes after the appointment. */
  bufferByServiceId?: Record<string, number>;
  offs?: TimeOff[];
  /** staffId → usual weekly hours (owner hours already applied as fallback). */
  hoursByStaff?: Record<string, WorkingHour[]>;
};

function hourLabels(startMin: number, endMin: number): number[] {
  const labels: number[] = [];
  const first = Math.ceil(startMin / 60) * 60;
  for (let m = first; m < endMin; m += 60) labels.push(m);
  return labels;
}

function formatHour(min: number): string {
  const h = Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:00`;
}

export function BookingsStaffDayView({
  dateStr,
  onDateChange,
  bookings,
  staff,
  clientById,
  serviceById,
  bufferByServiceId = {},
  offs = [],
  hoursByStaff = {},
}: Props) {
  const dayBookings = activeBookingsOnDate(bookings, dateStr);
  const dayOffs = timeOffOnDate(offs, dateStr);
  const columns = staffColumnsForDay(staff, dayBookings);
  const knownStaffIds = new Set(staff.map((s) => s.id));
  const { start: windowStart, end: windowEnd } = dayWindowMinutes(
    dayBookings,
    bufferByServiceId,
    dayOffs,
  );
  const height = (windowEnd - windowStart) * PX_PER_MIN;
  const hours = hourLabels(windowStart, windowEnd);

  return (
    <Card className="ring-1 ring-brand-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Team day view</CardTitle>
            <CardDescription>
              One column per person. Grey blocks are outside working hours or one-off blocked time;
              hatched pink strips are service cleanup buffers.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onDateChange(addDaysToDateStr(dateStr, -1))}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-white/[0.07]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-medium text-ink">
              {fmtDate(`${dateStr}T12:00:00Z`)}
            </p>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => onDateChange(addDaysToDateStr(dateStr, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-white/[0.07]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                onDateChange(
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Europe/London",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date()),
                )
              }
              className="ml-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.06]"
            >
              Today
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {columns.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">No team members yet.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `3rem repeat(${columns.length}, minmax(${COL_MIN_WIDTH}px, 1fr))`,
                minWidth: 3 * 16 + columns.length * COL_MIN_WIDTH,
              }}
            >
              <div className="sticky left-0 z-10 bg-surface/95" />
              {columns.map((col) => {
                const count = bookingsInColumn(dayBookings, col.id, knownStaffIds).length;
                return (
                  <div
                    key={col.id}
                    className="border-b border-l border-edge px-2 py-2 text-center"
                  >
                    <p className="truncate text-sm font-medium text-ink">{col.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {count} booking{count === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}

              <div className="relative sticky left-0 z-10 bg-surface/95" style={{ height }}>
                {hours.map((m) => (
                  <div
                    key={m}
                    className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-ink-faint"
                    style={{ top: (m - windowStart) * PX_PER_MIN }}
                  >
                    {formatHour(m)}
                  </div>
                ))}
              </div>

              {columns.map((col) => {
                const colBookings = bookingsInColumn(dayBookings, col.id, knownStaffIds);
                const colOffs = timeOffInColumn(dayOffs, col.id);
                const outsideHours =
                  col.id === UNASSIGNED_STAFF_ID
                    ? []
                    : unavailableRangesForStaffDay(
                        hoursByStaff[col.id] ?? [],
                        dateStr,
                        windowStart,
                        windowEnd,
                      );
                const laidOut = packBookingLanes(colBookings, (b) => {
                  const bufferMin = Math.max(0, bufferByServiceId[b.serviceId] ?? 0);
                  return minutesFromMidnightLondon(b.endIso) + bufferMin;
                });
                return (
                  <div
                    key={col.id}
                    className="relative border-l border-edge bg-cream/40"
                    style={{ height }}
                  >
                    {hours.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute inset-x-0 border-t border-edge/60"
                        style={{ top: (m - windowStart) * PX_PER_MIN }}
                      />
                    ))}
                    {outsideHours.map((range, i) => {
                      const top = (range.startM - windowStart) * PX_PER_MIN;
                      const blockHeight = Math.max(20, (range.endM - range.startM) * PX_PER_MIN - 2);
                      return (
                        <div
                          key={`hours-${i}`}
                          className="absolute inset-x-1 z-[1] overflow-hidden rounded-lg border border-edge bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_4px,transparent_4px,transparent_8px)] px-1.5 py-1"
                          style={{ top, height: blockHeight }}
                          title="Outside working hours"
                        >
                          <p className="truncate text-[10px] font-medium text-ink-soft">
                            Unavailable
                          </p>
                        </div>
                      );
                    })}
                    {colOffs.map((o) => {
                      const startM = Math.max(
                        windowStart,
                        minutesFromMidnightLondon(o.startIso),
                      );
                      const endM = Math.min(windowEnd, minutesFromMidnightLondon(o.endIso));
                      if (endM <= startM) return null;
                      const top = (startM - windowStart) * PX_PER_MIN;
                      const blockHeight = Math.max(20, (endM - startM) * PX_PER_MIN - 2);
                      return (
                        <div
                          key={o.id}
                          className="absolute inset-x-1 z-[1] overflow-hidden rounded-lg border border-edge bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_4px,transparent_4px,transparent_8px)] px-1.5 py-1"
                          style={{ top, height: blockHeight }}
                          title={o.reason || "Blocked"}
                        >
                          <p className="truncate text-[10px] font-medium text-ink-soft">
                            Unavailable
                          </p>
                          {o.reason && (
                            <p className="truncate text-[10px] text-ink-faint">{o.reason}</p>
                          )}
                        </div>
                      );
                    })}
                    {laidOut.map(({ booking: b, lane, laneCount, startM, endM }) => {
                      const apptEndM = minutesFromMidnightLondon(b.endIso);
                      const bufferMin = Math.max(0, endM - apptEndM);
                      const top = (startM - windowStart) * PX_PER_MIN;
                      const blockHeight = Math.max(28, (endM - startM) * PX_PER_MIN - 2);
                      const apptHeight =
                        bufferMin > 0
                          ? Math.max(18, (apptEndM - startM) * PX_PER_MIN)
                          : blockHeight;
                      const widthPct = 100 / laneCount;
                      const leftPct = lane * widthPct;
                      return (
                        <div
                          key={b.id}
                          className="absolute z-[2] overflow-hidden rounded-lg border border-brand-400/40 bg-brand-500/15 shadow-sm"
                          style={{
                            top,
                            height: blockHeight,
                            left: `calc(${leftPct}% + ${LANE_GAP_PX}px)`,
                            width: `calc(${widthPct}% - ${LANE_GAP_PX * 2}px)`,
                          }}
                        >
                          <div
                            className="overflow-hidden px-1.5 py-1"
                            style={{ height: Math.min(apptHeight, blockHeight) }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/dashboard/bookings/${b.id}`}
                                  className="block truncate text-xs font-semibold text-ink hover:text-brand-300"
                                >
                                  {clientById[b.clientId] ?? "Client"}
                                </Link>
                                <p className="truncate text-[10px] text-ink-faint">
                                  {fmtTime(b.startIso)} · {serviceById[b.serviceId] ?? "Service"}
                                </p>
                                <div className="mt-0.5 origin-left scale-90">
                                  {statusBadge(b.status)}
                                </div>
                              </div>
                              <div className="shrink-0 origin-top-right scale-90">
                                <BookingActions id={b.id} status={b.status} />
                              </div>
                            </div>
                          </div>
                          {bufferMin > 0 && blockHeight > apptHeight + 4 && (
                            <div
                              className="absolute inset-x-0 bottom-0 border-t border-dashed border-brand-400/50 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(255,255,255,0.06)_3px,rgba(255,255,255,0.06)_6px)]"
                              style={{ height: blockHeight - apptHeight }}
                              title={`${bufferMin} min cleanup buffer`}
                            >
                              {blockHeight - apptHeight >= 14 && (
                                <p className="px-1.5 pt-0.5 text-[9px] text-ink-faint">Buffer</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {dayBookings.length === 0 && (
              <p className="mt-3 text-center text-sm text-ink-faint">Nothing booked this day.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
