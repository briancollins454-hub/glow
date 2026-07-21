import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { weekDatesContaining, weekdayOfDateStr } from "@/lib/rota";
import { staffColumnsForDay } from "@/lib/booking/staff-day";
import type { StaffMember } from "@/lib/db/types";

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "stf_1",
    techId: "tech_1",
    authUserId: null,
    name: "Amy",
    email: "",
    role: "staff",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("team day navigation reaches every day of the week", () => {
  it("weekDatesContaining returns Mon..Sun including Saturday and Sunday", () => {
    // 2026-07-21 is a Tuesday.
    const days = weekDatesContaining("2026-07-21");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-07-20"); // Monday
    expect(days[5]).toBe("2026-07-25"); // Saturday
    expect(days[6]).toBe("2026-07-26"); // Sunday
    expect(days.map(weekdayOfDateStr)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("a day with no bookings still shows every active staff column", () => {
    const staff = [
      makeStaff({ id: "a", name: "Amy", sortOrder: 0 }),
      makeStaff({ id: "b", name: "Beth", sortOrder: 1 }),
      makeStaff({ id: "c", name: "Cleo", sortOrder: 2, active: false }),
    ];
    const cols = staffColumnsForDay(staff, []);
    expect(cols.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("team day view scroll container", () => {
  const view = readFileSync(
    resolve(__dirname, "../components/dashboard/bookings-staff-day-view.tsx"),
    "utf8",
  );
  const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it("staff columns live in the horizontal scroller with a sticky time axis", () => {
    expect(view).toContain('<div className="calendar-scroll-x pb-2">');
    expect(view).toMatch(/sticky left-0 z-10 bg-surface/);
    // Columns keep a real minimum width so they overflow (and scroll) on phones.
    expect(view).toMatch(/COL_MIN_WIDTH = \d+/);
    expect(view).toContain("minWidth: TIME_AXIS_REM * 16 + columns.length * COL_MIN_WIDTH");
  });

  it("week strip renders all 7 days for one-tap access to weekends", () => {
    expect(view).toContain("weekDatesContaining(dateStr)");
    expect(view).toContain("weekDates.map(");
  });

  it("scroller CSS enables touch panning and momentum in the PWA", () => {
    expect(css).toMatch(/\.calendar-scroll-x\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.calendar-scroll-x\s*\{[^}]*touch-action:\s*pan-x pan-y/);
    expect(css).toMatch(/\.calendar-scroll-x\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);
    expect(css).toMatch(/\.calendar-scroll-x\s*\{[^}]*max-width:\s*100%/);
  });
});
