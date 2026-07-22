import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addDaysToDateStr,
  addMonthsToMonthStart,
  firstOfMonthContaining,
  formatDateAriaLabel,
  mondayOfWeekContaining,
  monthGridForMonth,
  weekdayOfDateStr,
} from "@/lib/rota";
import { dayWindowForDate } from "@/lib/rules";
import type { RotaHour, WorkingHour } from "@/lib/db/types";

describe("bookings loader rota fetch matches bookings window", () => {
  it("uses the same ±90 / +365 day horizon for rota as for bookings", () => {
    const src = readFileSync(join(process.cwd(), "lib/dashboard/page-loaders.ts"), "utf8");
    const bookingsCase = src.slice(src.indexOf('case "bookings"'), src.indexOf('case "services"'));
    expect(bookingsCase).toContain("now - 90 * 24 * 60 * 60 * 1000");
    expect(bookingsCase).toContain("now + 365 * 24 * 60 * 60 * 1000");
    // Both windowStart/End and fromWeek/toWeek must use those offsets.
    expect(bookingsCase).toMatch(
      /windowStart[\s\S]*now - 90 \* 24 \* 60 \* 60 \* 1000[\s\S]*windowEnd[\s\S]*now \+ 365 \* 24 \* 60 \* 60 \* 1000/,
    );
    expect(bookingsCase).toMatch(
      /fromWeek[\s\S]*now - 90 \* 24 \* 60 \* 60 \* 1000[\s\S]*toWeek[\s\S]*now \+ 365 \* 24 \* 60 \* 60 \* 1000/,
    );
    // Guard against the old narrow rota window creeping back.
    expect(bookingsCase).not.toMatch(/fromWeek[\s\S]*now - 7 \* 24/);
    expect(bookingsCase).not.toMatch(/toWeek[\s\S]*now \+ 120 \* 24/);
    expect(bookingsCase).toContain("rotaFetchedRange");
  });
});

describe("monthGridForMonth", () => {
  it("builds Monday-first rows and includes adjacent-month days", () => {
    // November 2026 starts on Sunday → grid starts Mon 26 Oct.
    expect(weekdayOfDateStr("2026-11-01")).toBe(0); // Sunday
    const cells = monthGridForMonth("2026-11-01");
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toEqual({ dateStr: "2026-10-26", inMonth: false });
    expect(weekdayOfDateStr(cells[0]!.dateStr)).toBe(1); // Monday
    const firstInMonth = cells.find((c) => c.dateStr === "2026-11-01");
    expect(firstInMonth).toEqual({ dateStr: "2026-11-01", inMonth: true });
    const lastInMonth = cells.find((c) => c.dateStr === "2026-11-30");
    expect(lastInMonth).toEqual({ dateStr: "2026-11-30", inMonth: true });
    // Last cell is after Nov 30 and completes the week.
    const last = cells[cells.length - 1]!;
    expect(last.dateStr >= "2026-11-30").toBe(true);
    expect(weekdayOfDateStr(last.dateStr)).toBe(0); // Sunday
  });

  it("selecting a day outside the current month navigates across the boundary", () => {
    const cells = monthGridForMonth("2026-11-15");
    const outside = cells.find((c) => !c.inMonth && c.dateStr.startsWith("2026-10"));
    expect(outside).toBeTruthy();
    // Jumping to that day lands in October; month containing it is October.
    expect(firstOfMonthContaining(outside!.dateStr)).toBe("2026-10-01");
    expect(addMonthsToMonthStart("2026-11-01", -1)).toBe("2026-10-01");
    expect(addDaysToDateStr("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("formats accessible day labels", () => {
    expect(formatDateAriaLabel("2026-11-30")).toBe("Monday 30 November 2026");
  });
});

describe("dayWindowForDate rota 200 days ahead", () => {
  it("uses saved rota over recurring hours when that week is in ctx", () => {
    const base = "2030-01-07"; // Monday
    const far = addDaysToDateStr(base, 200);
    const weekStart = mondayOfWeekContaining(far);
    const weekday = weekdayOfDateStr(far);

    const recurring: WorkingHour[] = [
      {
        id: "wh",
        techId: "tech_1",
        staffId: "stf_1",
        weekday,
        startMinutes: 9 * 60,
        endMinutes: 17 * 60,
        lastStartMinutes: null,
        enabled: true,
      },
    ];
    const rota: RotaHour[] = [
      {
        id: "rota_far",
        techId: "tech_1",
        staffId: "stf_1",
        weekStart,
        weekday,
        startMinutes: 11 * 60,
        endMinutes: 15 * 60,
        lastStartMinutes: null,
        enabled: true,
      },
    ];

    expect(
      dayWindowForDate(far, {
        workingHours: recurring,
        timeOff: [],
        bookings: [],
        rotaHours: rota,
        rotaFetchedRange: {
          fromWeek: addDaysToDateStr(base, -90),
          toWeek: addDaysToDateStr(base, 365),
        },
      }),
    ).toEqual({
      startMinutes: 11 * 60,
      endMinutes: 15 * 60,
      lastStartMinutes: null,
    });
  });

  it("warns in non-production when date is outside rotaFetchedRange (no behaviour change)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const dateStr = "2030-12-01";
    const weekStart = mondayOfWeekContaining(dateStr);
    dayWindowForDate(dateStr, {
      workingHours: [
        {
          id: "wh",
          techId: "t",
          staffId: null,
          weekday: weekdayOfDateStr(dateStr),
          startMinutes: 9 * 60,
          endMinutes: 17 * 60,
          lastStartMinutes: null,
          enabled: true,
        },
      ],
      timeOff: [],
      bookings: [],
      rotaHours: [],
      rotaFetchedRange: { fromWeek: "2030-01-01", toWeek: "2030-06-01" },
    });
    expect(weekStart > "2030-06-01").toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
