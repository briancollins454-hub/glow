import { describe, expect, it } from "vitest";
import {
  ACUITY_NO_CALENDAR,
  acuityRowCalendarName,
  findStaffForCalendarName,
  normalizeStaffMatchName,
} from "@/lib/import/staff-map";

describe("findStaffForCalendarName", () => {
  const staff = [
    { id: "stf_claire", name: "Claire Adams" },
    { id: "stf_tammy", name: "Tammy Bingham" },
    { id: "stf_melissa", name: "Melissa Bingham" },
  ];

  it("matches Acuity Calendar names to Glow staff (case/spacing insensitive)", () => {
    expect(findStaffForCalendarName("Claire Adams", staff)?.id).toBe("stf_claire");
    expect(findStaffForCalendarName("  tammy  bingham ", staff)?.id).toBe("stf_tammy");
    expect(findStaffForCalendarName("MELISSA BINGHAM", staff)?.id).toBe("stf_melissa");
  });

  it("returns null for unknown calendars and the blank placeholder", () => {
    expect(findStaffForCalendarName("Someone Else", staff)).toBeNull();
    expect(findStaffForCalendarName(ACUITY_NO_CALENDAR, staff)).toBeNull();
    expect(findStaffForCalendarName("", staff)).toBeNull();
  });
});

describe("acuityRowCalendarName", () => {
  it("reads the Calendar cell and normalises blanks", () => {
    expect(acuityRowCalendarName(["Claire Adams"], 0)).toBe("Claire Adams");
    expect(acuityRowCalendarName([""], 0)).toBe(ACUITY_NO_CALENDAR);
    expect(acuityRowCalendarName(["x"], -1)).toBe("");
  });
});

describe("normalizeStaffMatchName", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeStaffMatchName("  Claire   Adams ")).toBe("claire adams");
  });
});
