import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_STAFF_ID,
  activeBookingsOnDate,
  bookingsInColumn,
  dayWindowMinutes,
  minutesFromMidnightLondon,
  staffColumnsForDay,
} from "@/lib/booking/staff-day";
import type { StaffMember } from "@/lib/db/types";
import { makeBooking } from "./fixtures";

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
});
