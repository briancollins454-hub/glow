import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { rowsForStaff } from "@/lib/booking/staff";
import { daySlots } from "@/lib/rules";
import type { Booking, StaffMember } from "@/lib/db/types";
import { makeBooking, makeService, makeWorkingHour } from "./fixtures";

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "stf_1",
    techId: "tech_1",
    authUserId: null,
    name: "Amy",
    email: "amy@example.com",
    role: "staff",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("multi-staff slot conflict (app-level)", () => {
  const amy = makeStaff({ id: "stf_amy", name: "Amy" });
  const claire = makeStaff({ id: "stf_claire", name: "Claire", role: "owner" });
  const service = makeService({ durationMin: 60 });
  const hours = makeWorkingHour({
    weekday: 3, // Wednesday
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  });
  const dateStr = "2030-07-10"; // Wednesday
  const now = new Date("2030-07-01T00:00:00.000Z").getTime();
  const slot = "2030-07-10T10:00:00.000Z"; // 11:00 London

  const amyBusy: Booking = makeBooking({
    id: "bk_amy",
    staffId: amy.id,
    startIso: slot,
    endIso: "2030-07-10T11:00:00.000Z",
    status: "confirmed",
  });

  it("same time for a different staff member stays free", () => {
    const claireBookings = rowsForStaff([amyBusy], claire);
    const slots = daySlots(
      service,
      dateStr,
      { workingHours: [hours], timeOff: [], bookings: claireBookings },
      now,
    );
    expect(slots).toContain(slot);
  });

  it("same time for the same staff member is blocked", () => {
    const amyBookings = rowsForStaff([amyBusy], amy);
    const slots = daySlots(
      service,
      dateStr,
      { workingHours: [hours], timeOff: [], bookings: amyBookings },
      now,
    );
    expect(slots).not.toContain(slot);
  });

  it("NULL-staff bookings block the owner diary but not another staff member", () => {
    const unassigned: Booking = makeBooking({
      id: "bk_null",
      staffId: null,
      startIso: slot,
      endIso: "2030-07-10T11:00:00.000Z",
      status: "confirmed",
    });
    expect(rowsForStaff([unassigned], claire).map((b) => b.id)).toEqual(["bk_null"]);
    expect(rowsForStaff([unassigned], amy)).toEqual([]);

    const ownerSlots = daySlots(
      service,
      dateStr,
      { workingHours: [hours], timeOff: [], bookings: rowsForStaff([unassigned], claire) },
      now,
    );
    const amySlots = daySlots(
      service,
      dateStr,
      { workingHours: [hours], timeOff: [], bookings: rowsForStaff([unassigned], amy) },
      now,
    );
    expect(ownerSlots).not.toContain(slot);
    expect(amySlots).toContain(slot);
  });
});

describe("migration 0042 slot unique indexes", () => {
  const sql = readFileSync(
    resolve(__dirname, "../supabase/migrations/0042_booking_slot_unique_per_staff.sql"),
    "utf8",
  );

  it("drops the pre-multi-staff tech-wide unique index", () => {
    expect(sql).toMatch(/drop index if exists idx_bookings_tech_start_active/i);
  });

  it("creates per-staff and NULL-staff partial unique indexes", () => {
    expect(sql).toMatch(
      /idx_bookings_staff_start_active[\s\S]*\("techId", "staffId", "startIso"\)[\s\S]*"staffId" is not null/i,
    );
    expect(sql).toMatch(
      /idx_bookings_unassigned_start_active[\s\S]*\("techId", "startIso"\)[\s\S]*"staffId" is null/i,
    );
  });

  it("documents the two-partial-index approach in comments", () => {
    expect(sql).toMatch(/two partial indexes/i);
    expect(sql).toMatch(/NULL-staff booking does NOT conflict with a staff-assigned/i);
  });
});
