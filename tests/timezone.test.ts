import { describe, expect, it } from "vitest";
import { daySlotsForDuration, dateStrInTz, type AvailabilityCtx } from "@/lib/rules";
import { salonDayKey } from "@/lib/reminder-batch";
import { fmtRelativeDays } from "@/lib/format";
import { makeWorkingHour } from "./fixtures";

/** 09:00–17:00 hours for every weekday, so any test date is open. */
function allWeekHours() {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    makeWorkingHour({ id: `wh_${weekday}`, weekday }),
  );
}

function ctxFor(tz: string): AvailabilityCtx {
  return { tz, workingHours: allWeekHours(), timeOff: [], bookings: [] };
}

const NOW = new Date("2026-03-01T00:00:00.000Z").getTime();

describe("slot generation in the salon's timezone", () => {
  it("a Sydney salon's 09:00 Monday slot is 09:00 Sydney time as the right UTC instant", () => {
    // Monday 2026-03-02 — Sydney is UTC+11 (AEDT), so 09:00 local = 22:00 UTC the day before.
    const slots = daySlotsForDuration(60, "2026-03-02", ctxFor("Australia/Sydney"), NOW);
    expect(slots[0]).toBe("2026-03-01T22:00:00.000Z");
    // Sanity: that instant is 09:00 on the requested calendar day in Sydney.
    expect(
      new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(slots[0]!)),
    ).toBe("09:00");
    expect(dateStrInTz(new Date(slots[0]!), "Australia/Sydney")).toBe("2026-03-02");
  });

  it("the same rota in London produces a different UTC instant", () => {
    const sydney = daySlotsForDuration(60, "2026-03-02", ctxFor("Australia/Sydney"), NOW);
    const london = daySlotsForDuration(60, "2026-03-02", ctxFor("Europe/London"), NOW);
    expect(london[0]).toBe("2026-03-02T09:00:00.000Z");
    expect(london[0]).not.toBe(sydney[0]);
  });

  function expectCleanDay(tz: string, dateStr: string) {
    const slots = daySlotsForDuration(60, dateStr, ctxFor(tz), NOW);
    // 09:00 through 16:00 last start, every 15 min → 29 slots. A 23/25-hour
    // day or a duplicated/missing wall-clock hour would change this count.
    expect(slots).toHaveLength(29);
    expect(new Set(slots).size).toBe(slots.length);
    for (const iso of slots) {
      expect(dateStrInTz(new Date(iso), tz)).toBe(dateStr);
    }
    const first = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(slots[0]!));
    expect(first).toBe("09:00");
  }

  it("handles the Australian DST end (first Sunday in April 2026)", () => {
    expectCleanDay("Australia/Sydney", "2026-04-05");
    expectCleanDay("Australia/Sydney", "2026-04-06");
  });

  it("handles the Australian DST start (first Sunday in October 2026)", () => {
    expectCleanDay("Australia/Sydney", "2026-10-04");
    expectCleanDay("Australia/Sydney", "2026-10-05");
  });

  it("handles the UK DST end on 25 October 2026", () => {
    expectCleanDay("Europe/London", "2026-10-25");
    expectCleanDay("Europe/London", "2026-10-26");
  });
});

describe("salonDayKey", () => {
  it("groups bookings on the same salon-local day even across UTC days", () => {
    // 22:30 UTC on the 1st and 01:30 UTC on the 2nd are both 2 June in Sydney.
    const a = "2026-06-01T22:30:00.000Z";
    const b = "2026-06-02T01:30:00.000Z";
    expect(salonDayKey(a, "Australia/Sydney")).toBe("2026-06-02");
    expect(salonDayKey(a, "Australia/Sydney")).toBe(salonDayKey(b, "Australia/Sydney"));
    // In UTC (or London winter) they fall on different days.
    expect(salonDayKey(a, "Europe/London")).not.toBe(salonDayKey(b, "Europe/London"));
  });
});

describe("fmtRelativeDays", () => {
  it("compares calendar days in the salon's zone, not 24-hour blocks", () => {
    // Now: 23:00 Sydney on 1 June (13:00 UTC). 10:00 Sydney on 2 June is only
    // 11 hours away but is still "tomorrow" in the salon's calendar.
    const nowMs = new Date("2026-06-01T13:00:00.000Z").getTime();
    const target = "2026-06-02T00:00:00.000Z"; // 10:00 Sydney, 2 June
    expect(fmtRelativeDays(target, "Australia/Sydney", nowMs)).toBe("tomorrow");
    // In London that same instant is 01:00 on 2 June while "now" is 14:00 on
    // 1 June — also tomorrow. Same-day case:
    expect(fmtRelativeDays("2026-06-01T20:00:00.000Z", "Europe/London", nowMs)).toBe("today");
    expect(fmtRelativeDays("2026-06-01T20:00:00.000Z", "Australia/Sydney", nowMs)).toBe(
      "tomorrow",
    );
  });
});
