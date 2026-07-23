import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeBooking, makeClient, makeService, makeTech, makeWorkingHour } from "./fixtures";
import { dbError, isExclusionViolation, isSlotConflictViolation } from "@/lib/db/errors";
import { findOverlappingBooking } from "@/lib/booking/dashboard-slot";
import { daySlotChoicesForDuration } from "@/lib/rules";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("findOverlappingBooking / day slot choices", () => {
  it("names an overlapping booking and excludes the booking being moved", () => {
    const existing = makeBooking({
      id: "bk_taken",
      status: "confirmed",
      startIso: "2026-09-01T10:00:00.000Z",
      endIso: "2026-09-01T11:00:00.000Z",
      staffId: "st_1",
    });
    const moving = makeBooking({
      id: "bk_move",
      status: "confirmed",
      startIso: "2026-09-01T10:00:00.000Z",
      endIso: "2026-09-01T11:00:00.000Z",
      staffId: "st_1",
    });

    expect(
      findOverlappingBooking("2026-09-01T10:00:00.000Z", 60, [existing], {})?.id,
    ).toBe("bk_taken");

    expect(
      findOverlappingBooking("2026-09-01T10:00:00.000Z", 60, [moving], {
        excludeBookingId: "bk_move",
      }),
    ).toBeNull();
  });

  it("marks taken times with the conflicting booking id", () => {
    const hours = [makeWorkingHour({ weekday: 2, startMinutes: 9 * 60, endMinutes: 17 * 60 })];
    // 2026-09-01 is a Tuesday (weekday 2).
    const taken = makeBooking({
      id: "bk_sophie",
      status: "confirmed",
      startIso: "2026-09-01T10:00:00.000Z",
      endIso: "2026-09-01T11:00:00.000Z",
    });
    const choices = daySlotChoicesForDuration(
      60,
      "2026-09-01",
      {
        workingHours: hours,
        timeOff: [],
        bookings: [taken],
      },
      0,
    );
    const clash = choices.find((c) => c.takenByBookingId === "bk_sophie");
    expect(clash).toBeTruthy();
    expect(choices.some((c) => !c.takenByBookingId)).toBe(true);
  });
});

describe("dashboard slot check fail-closed + overbook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks when availability queries throw rather than soft-allowing", async () => {
    vi.doMock("@/lib/db/queries", () => ({
      listWorkingHours: vi.fn(async () => {
        throw new Error("hours boom");
      }),
      listTimeOff: vi.fn(async () => []),
      listBookingsInWindow: vi.fn(async () => []),
      listRotaHours: vi.fn(async () => []),
      listStaff: vi.fn(async () => []),
      listServices: vi.fn(async () => [makeService()]),
      getStaff: vi.fn(async () => null),
      getClient: vi.fn(async () => makeClient()),
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({}),
    }));

    const { checkDashboardStaffSlot } = await import("@/lib/booking/dashboard-slot");
    const result = await checkDashboardStaffSlot({} as never, makeTech(), {
      startIso: "2026-09-01T10:00:00.000Z",
      durationMin: 60,
      staffId: "st_1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("verify_failed");
  });

  it("returns a named conflict when the slot is taken", async () => {
    const taken = makeBooking({
      id: "bk_taken",
      status: "confirmed",
      clientId: "cli_1",
      staffId: "st_1",
      startIso: "2026-09-01T10:00:00.000Z",
      endIso: "2026-09-01T11:00:00.000Z",
    });
    vi.doMock("@/lib/db/queries", () => ({
      listWorkingHours: vi.fn(async () => [
        makeWorkingHour({ weekday: 2, startMinutes: 9 * 60, endMinutes: 17 * 60 }),
      ]),
      listTimeOff: vi.fn(async () => []),
      listBookingsInWindow: vi.fn(async () => [taken]),
      listRotaHours: vi.fn(async () => []),
      listStaff: vi.fn(async () => [
        { id: "st_1", techId: "tech_1", name: "Bella", role: "owner", active: true, email: "", color: "#db2777", sortOrder: 0, createdAt: "" },
      ]),
      listServices: vi.fn(async () => [makeService()]),
      getStaff: vi.fn(async () => null),
      getClient: vi.fn(async () => makeClient({ name: "Sophie Turner" })),
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({}),
    }));

    const { checkDashboardStaffSlot } = await import("@/lib/booking/dashboard-slot");
    const result = await checkDashboardStaffSlot({} as never, makeTech(), {
      startIso: "2026-09-01T10:00:00.000Z",
      durationMin: 60,
      staffId: "st_1",
    });
    expect(result).toEqual({
      ok: false,
      reason: "conflict",
      conflict: {
        bookingId: "bk_taken",
        clientName: "Sophie Turner",
        startIso: "2026-09-01T10:00:00.000Z",
      },
    });
  });

  it("treats the booking's own slot as free when excluded", async () => {
    const self = makeBooking({
      id: "bk_self",
      status: "confirmed",
      staffId: "st_1",
      startIso: "2026-09-01T10:00:00.000Z",
      endIso: "2026-09-01T11:00:00.000Z",
    });
    vi.doMock("@/lib/db/queries", () => ({
      listWorkingHours: vi.fn(async () => [
        makeWorkingHour({ weekday: 2, startMinutes: 9 * 60, endMinutes: 17 * 60 }),
      ]),
      listTimeOff: vi.fn(async () => []),
      listBookingsInWindow: vi.fn(async () => [self]),
      listRotaHours: vi.fn(async () => []),
      listStaff: vi.fn(async () => [
        { id: "st_1", techId: "tech_1", name: "Bella", role: "owner", active: true, email: "", color: "#db2777", sortOrder: 0, createdAt: "" },
      ]),
      listServices: vi.fn(async () => [makeService()]),
      getStaff: vi.fn(async () => null),
      getClient: vi.fn(async () => makeClient()),
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({}),
    }));

    const { checkDashboardStaffSlot } = await import("@/lib/booking/dashboard-slot");
    const result = await checkDashboardStaffSlot({} as never, makeTech(), {
      startIso: "2026-09-01T10:00:00.000Z",
      durationMin: 60,
      staffId: "st_1",
      excludeBookingId: "bk_self",
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("reschedule / manual actions wire-up", () => {
  it("rescheduleBookingAction validates slots, names conflicts, and supports overbook", () => {
    const src = read("app/dashboard/actions.ts");
    const start = src.indexOf("export async function rescheduleBookingAction");
    const end = src.indexOf("export async function recordManualPaymentAction", start);
    const fn = src.slice(start, end);
    expect(fn).toContain("checkDashboardStaffSlot");
    expect(fn).toContain("excludeBookingId");
    expect(fn).toContain("confirmOverbook");
    expect(fn).toContain("allowOverlap");
    expect(fn).toContain("err=slot");
    expect(fn).toContain("err=verify");
    expect(fn).toMatch(/isSlotConflictViolation/);
  });

  it("addManualBookingAction fails closed and requires confirm for overbook", () => {
    const src = read("app/dashboard/actions.ts");
    const start = src.indexOf("export async function addManualBookingAction");
    const end = src.indexOf("export async function rescheduleBookingAction", start);
    const fn = src.slice(start, end);
    expect(fn).toContain("checkDashboardStaffSlot");
    expect(fn).toContain("confirmOverbook");
    expect(fn).toContain("allowOverlap");
    expect(fn).toContain("error=verify");
    expect(fn).not.toContain("Soft-fail");
    expect(fn).not.toContain("customTime");
  });

  it("booking edit page names the conflicting client", () => {
    const src = read("app/dashboard/bookings/[id]/page.tsx");
    expect(src).toContain("This slot is taken by");
    expect(src).toContain("err === \"verify\"");
    expect(src).toContain("BookingRescheduleForm");
  });
});

describe("exclusion constraint migration + overbook flag", () => {
  const sql = read("supabase/migrations/0045_booking_overlap_exclusion.sql");

  it("adds allowOverlap, btree_gist exclusion NOT VALID, and relaxes unique indexes", () => {
    expect(sql).toContain("btree_gist");
    expect(sql).toContain('"allowOverlap"');
    expect(sql).toContain("bookings_staff_no_overlap");
    expect(sql).toMatch(/not valid/i);
    expect(sql).toContain("tstzrange(\"startIso\", \"endIso\"");
    expect(sql).toContain("not \"allowOverlap\"");
    expect(sql).toContain("idx_bookings_staff_start_active");
  });

  it("treats exclusion violations as slot conflicts", () => {
    const err = dbError("createBooking", {
      message: 'conflicting key value violates exclusion constraint "bookings_staff_no_overlap"',
      code: "23P01",
    });
    expect(isExclusionViolation(err)).toBe(true);
    expect(isSlotConflictViolation(err)).toBe(true);
  });

  it("documents that flagged overbooks escape the overlap predicate", () => {
    // Mirror the migration WHERE clause for a raw overlapping insert:
    // rows with allowOverlap=true are excluded from the constraint.
    const active = (row: { status: string; allowOverlap: boolean; staffId: string | null }) =>
      row.staffId != null &&
      !row.allowOverlap &&
      ["pending_approval", "pending", "confirmed", "completed"].includes(row.status);

    const existing = { status: "confirmed", allowOverlap: false, staffId: "st_1" };
    const rawOverlap = { status: "confirmed", allowOverlap: false, staffId: "st_1" };
    const flagged = { status: "confirmed", allowOverlap: true, staffId: "st_1" };

    expect(active(existing) && active(rawOverlap)).toBe(true); // would be rejected
    expect(active(existing) && active(flagged)).toBe(false); // accepted overbook
  });
});

describe("picker + month-view booking entry", () => {
  it("date-time picker greys taken times and requires overbook confirm", () => {
    const src = read("components/dashboard/date-time-picker.tsx");
    expect(src).toContain("takenInitial");
    expect(src).toContain('name="confirmOverbook" value="1"');
    expect(src).toContain("Book anyway?");
    expect(src).not.toContain("allowCustomTime");
    expect(src).not.toContain('name="customTime"');
  });

  it("manual form uses taken-slot choices; online booking does not", () => {
    const form = read("components/dashboard/manual-booking-form.tsx");
    expect(form).toContain("daySlotChoicesForDuration");
    expect(form).toContain("takenInitial");
    expect(form).not.toContain("allowCustomTime");
    const online = read("components/booking/booking-step-interactive.tsx");
    expect(online).not.toContain("confirmOverbook");
  });

  it("month/day views open the prefilled manual booking form", () => {
    const page = read("app/dashboard/bookings/page.tsx");
    expect(page).toContain("openManualBooking");
    expect(page).toContain("defaultDate={manualPrefillDate}");
    expect(page).toContain("onAddBooking={openManualBooking}");
    const month = read("components/dashboard/bookings-month-calendar.tsx");
    expect(month).toContain("Add booking");
    expect(month).toContain("onAddBooking");
    const day = read("components/dashboard/bookings-staff-day-view.tsx");
    expect(day).toContain("Add booking");
    expect(day).toContain("onAddBooking");
  });
});
