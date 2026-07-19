import { describe, expect, it } from "vitest";
import {
  addDaysToDateStr,
  formatWeekLabel,
  mondayOfWeekContaining,
  weekdayOfDateStr,
} from "@/lib/rota";
import { daySlotsForDuration, dayWindowForDate } from "@/lib/rules";
import type { RotaHour } from "@/lib/db/types";

describe("rota week maths", () => {
  it("finds the Monday of a week", () => {
    // 2030-07-10 is a Wednesday
    expect(weekdayOfDateStr("2030-07-10")).toBe(3);
    expect(mondayOfWeekContaining("2030-07-10")).toBe("2030-07-08");
    expect(mondayOfWeekContaining("2030-07-08")).toBe("2030-07-08");
    expect(mondayOfWeekContaining("2030-07-14")).toBe("2030-07-08"); // Sunday
  });

  it("adds days and formats labels", () => {
    expect(addDaysToDateStr("2030-07-08", 7)).toBe("2030-07-15");
    expect(formatWeekLabel("2030-07-08")).toContain("2030");
  });
});

describe("dayWindowForDate with rota", () => {
  const weekStart = "2030-07-08";
  const rota: RotaHour[] = [
    {
      id: "rota_wed",
      techId: "tech_1",
      staffId: "stf_1",
      weekStart,
      weekday: 3,
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
      lastStartMinutes: null,
      enabled: true,
    },
    {
      id: "rota_thu_off",
      techId: "tech_1",
      staffId: "stf_1",
      weekStart,
      weekday: 4,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      lastStartMinutes: null,
      enabled: false,
    },
  ];

  it("uses the rota day when a week is saved", () => {
    expect(
      dayWindowForDate("2030-07-10", {
        workingHours: [],
        timeOff: [],
        bookings: [],
        flexibleHours: { startMinutes: 9 * 60, endMinutes: 20 * 60, lastStartMinutes: null },
        rotaHours: rota,
      }),
    ).toEqual({
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
      lastStartMinutes: null,
    });
  });

  it("treats disabled rota days as closed even when flexible is on", () => {
    expect(
      dayWindowForDate("2030-07-11", {
        workingHours: [],
        timeOff: [],
        bookings: [],
        flexibleHours: { startMinutes: 9 * 60, endMinutes: 20 * 60, lastStartMinutes: null },
        rotaHours: rota,
      }),
    ).toBeNull();
  });

  it("falls back to flexible when the week has no rota rows", () => {
    expect(
      dayWindowForDate("2030-07-17", {
        workingHours: [],
        timeOff: [],
        bookings: [],
        flexibleHours: { startMinutes: 9 * 60, endMinutes: 20 * 60, lastStartMinutes: null },
        rotaHours: rota,
      }),
    ).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 20 * 60,
      lastStartMinutes: null,
    });
  });

  it("feeds daySlotsForDuration", () => {
    const slots = daySlotsForDuration(
      60,
      "2030-07-10",
      {
        workingHours: [],
        timeOff: [],
        bookings: [],
        flexibleHours: { startMinutes: 9 * 60, endMinutes: 20 * 60, lastStartMinutes: null },
        rotaHours: rota,
      },
      Date.parse("2030-01-01T00:00:00.000Z"),
    );
    expect(slots.length).toBeGreaterThan(0);
    // 10:00 BST = 09:00 UTC in July
    expect(slots[0]).toBe("2030-07-10T09:00:00.000Z");
  });
});
