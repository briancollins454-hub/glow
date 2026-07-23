import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dbError, isSlotConflictViolation, isUniqueViolation } from "@/lib/db/errors";

describe("reschedule staff-slot conflict", () => {
  it("treats the production unique-constraint Error as a slot conflict", () => {
    const err = dbError("updateBooking", {
      message: 'duplicate key value violates unique constraint "idx_bookings_staff_start_active"',
      code: "23505",
    });
    expect(err.message).toContain("idx_bookings_staff_start_active");
    expect(isUniqueViolation(err)).toBe(true);
    expect(isSlotConflictViolation(err)).toBe(true);
  });

  it("rescheduleBookingAction redirects to err=slot on unique/exclusion violation", () => {
    const src = readFileSync("app/dashboard/actions.ts", "utf8");
    const start = src.indexOf("export async function rescheduleBookingAction");
    const end = src.indexOf("export async function recordManualPaymentAction", start);
    const fn = src.slice(start, end);
    expect(fn).toMatch(/isSlotConflictViolation\(e\)/);
    expect(fn).toMatch(/err=slot/);
    expect(fn).toMatch(/updateBooking/);
    expect(fn).toContain("checkDashboardStaffSlot");
  });

  it("booking edit page explains a slot conflict with the conflicting client", () => {
    const src = readFileSync("app/dashboard/bookings/[id]/page.tsx", "utf8");
    expect(src).toContain('err === "slot"');
    expect(src).toContain("This slot is taken by");
  });
});
