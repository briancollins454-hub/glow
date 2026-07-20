import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_STAFF_ID,
  activeBookingsOnDate,
  bookingsInColumn,
  dayWindowMinutes,
  minutesFromMidnightLondon,
  packBookingLanes,
  staffColumnsForDay,
  timeOffAppliesToStaff,
  timeOffInColumn,
  timeOffOnDate,
  unavailableRangesForStaffDay,
} from "@/lib/booking/staff-day";
import type { StaffMember, TimeOff } from "@/lib/db/types";
import { makeBooking, makeWorkingHour } from "./fixtures";

function off(partial: Partial<TimeOff> & Pick<TimeOff, "id" | "startIso" | "endIso">): TimeOff {
  return {
    techId: "tech_1",
    reason: "",
    staffId: null,
    ...partial,
  };
}

function staff(partial: Partial<StaffMember> & Pick<StaffMember, "id" | "name">): StaffMember {
  return {
    techId: "tech_1",
    authUserId: null,
    email: "",
    role: "staff",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("staff day calendar helpers", () => {
  it("reads London minutes from an ISO instant", () => {
    // 10:00 BST in July = 09:00 UTC
    expect(minutesFromMidnightLondon("2030-07-10T09:00:00.000Z")).toBe(10 * 60);
  });

  it("filters active bookings for one date", () => {
    const day = [
      makeBooking({
        id: "b1",
        startIso: "2030-07-10T09:00:00.000Z",
        endIso: "2030-07-10T10:00:00.000Z",
        status: "confirmed",
      }),
      makeBooking({
        id: "b2",
        startIso: "2030-07-11T09:00:00.000Z",
        endIso: "2030-07-11T10:00:00.000Z",
        status: "confirmed",
      }),
      makeBooking({
        id: "b3",
        startIso: "2030-07-10T11:00:00.000Z",
        endIso: "2030-07-10T12:00:00.000Z",
        status: "cancelled",
      }),
    ];
    const onDay = activeBookingsOnDate(day, "2030-07-10");
    expect(onDay.map((b) => b.id)).toEqual(["b1"]);
  });

  it("builds staff columns and buckets unassigned", () => {
    const team = [
      staff({ id: "stf_a", name: "Amy", sortOrder: 1 }),
      staff({ id: "stf_b", name: "Ben", sortOrder: 0 }),
    ];
    const dayBookings = [
      makeBooking({ id: "b1", staffId: "stf_a" }),
      makeBooking({ id: "b2", staffId: null }),
    ];
    const cols = staffColumnsForDay(team, dayBookings);
    expect(cols.map((c) => c.id)).toEqual(["stf_b", "stf_a", UNASSIGNED_STAFF_ID]);
    const known = new Set(team.map((s) => s.id));
    expect(bookingsInColumn(dayBookings, "stf_a", known).map((b) => b.id)).toEqual(["b1"]);
    expect(bookingsInColumn(dayBookings, UNASSIGNED_STAFF_ID, known).map((b) => b.id)).toEqual([
      "b2",
    ]);
  });

  it("pads a day window around bookings", () => {
    const dayBookings = [
      makeBooking({
        startIso: "2030-07-10T10:00:00.000Z", // 11:00 London
        endIso: "2030-07-10T12:00:00.000Z", // 13:00 London
      }),
    ];
    const win = dayWindowMinutes(dayBookings);
    expect(win.start).toBeLessThanOrEqual(10 * 60);
    expect(win.end).toBeGreaterThanOrEqual(13 * 60);
  });

  it("extends the day window for service buffers", () => {
    const dayBookings = [
      makeBooking({
        id: "b1",
        serviceId: "svc_1",
        startIso: "2030-07-10T15:00:00.000Z", // 16:00 London
        endIso: "2030-07-10T16:00:00.000Z", // 17:00 London
      }),
    ];
    const win = dayWindowMinutes(dayBookings, { svc_1: 30 });
    expect(win.end).toBeGreaterThanOrEqual(17 * 60 + 30);
  });

  it("filters time off for a staff member vs salon-wide", () => {
    const rows = [
      off({
        id: "o1",
        startIso: "2030-07-10T11:00:00.000Z",
        endIso: "2030-07-10T12:00:00.000Z",
        staffId: null,
      }),
      off({
        id: "o2",
        startIso: "2030-07-10T13:00:00.000Z",
        endIso: "2030-07-10T14:00:00.000Z",
        staffId: "stf_a",
      }),
      off({
        id: "o3",
        startIso: "2030-07-10T15:00:00.000Z",
        endIso: "2030-07-10T16:00:00.000Z",
        staffId: "stf_b",
      }),
    ];
    expect(timeOffAppliesToStaff(rows, "stf_a").map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(timeOffInColumn(rows, "stf_a").map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(timeOffOnDate(rows, "2030-07-10")).toHaveLength(3);
    expect(timeOffOnDate(rows, "2030-07-11")).toHaveLength(0);
  });

  it("packs overlapping bookings into side-by-side lanes", () => {
    const a = makeBooking({
      id: "a",
      startIso: "2030-07-10T09:00:00.000Z", // 10:00
      endIso: "2030-07-10T10:00:00.000Z", // 11:00
    });
    const b = makeBooking({
      id: "b",
      startIso: "2030-07-10T09:30:00.000Z", // 10:30
      endIso: "2030-07-10T10:30:00.000Z", // 11:30
    });
    const c = makeBooking({
      id: "c",
      startIso: "2030-07-10T11:00:00.000Z", // 12:00
      endIso: "2030-07-10T12:00:00.000Z", // 13:00
    });
    const laid = packBookingLanes([a, b, c], (booking) =>
      minutesFromMidnightLondon(booking.endIso),
    );
    const byId = Object.fromEntries(laid.map((x) => [x.booking.id, x]));
    expect(byId.a!.lane).not.toBe(byId.b!.lane);
    expect(byId.a!.laneCount).toBe(2);
    expect(byId.b!.laneCount).toBe(2);
    expect(byId.c!.lane).toBe(0);
    expect(byId.c!.laneCount).toBe(1);
  });
});

describe("unavailableRangesForStaffDay", () => {
  // 2030-07-10 is a Wednesday (weekday 3).
  const dateStr = "2030-07-10";
  const windowStart = 9 * 60;
  const windowEnd = 17 * 60;

  it("returns before-open and after-close ranges for an enabled weekday", () => {
    const hours = [
      makeWorkingHour({
        weekday: 3,
        startMinutes: 10 * 60,
        endMinutes: 16 * 60,
        enabled: true,
      }),
    ];
    expect(unavailableRangesForStaffDay(hours, dateStr, windowStart, windowEnd)).toEqual([
      { startM: 9 * 60, endM: 10 * 60 },
      { startM: 16 * 60, endM: 17 * 60 },
    ]);
  });

  it("covers the whole window when the weekday is closed or missing", () => {
    expect(unavailableRangesForStaffDay([], dateStr, windowStart, windowEnd)).toEqual([
      { startM: windowStart, endM: windowEnd },
    ]);
    const closed = [
      makeWorkingHour({ weekday: 3, enabled: false, startMinutes: 10 * 60, endMinutes: 16 * 60 }),
    ];
    expect(unavailableRangesForStaffDay(closed, dateStr, windowStart, windowEnd)).toEqual([
      { startM: windowStart, endM: windowEnd },
    ]);
  });

  it("returns nothing when hours fill the visible window", () => {
    const hours = [
      makeWorkingHour({
        weekday: 3,
        startMinutes: 9 * 60,
        endMinutes: 17 * 60,
        enabled: true,
      }),
    ];
    expect(unavailableRangesForStaffDay(hours, dateStr, windowStart, windowEnd)).toEqual([]);
  });
});
