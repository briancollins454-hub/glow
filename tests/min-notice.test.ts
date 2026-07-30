import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clampMinNoticeHours,
  effectiveMinNoticeHours,
  isInsideMinNoticeWindow,
  minNoticeFloorMs,
  techMinNoticeHours,
} from "@/lib/booking/min-notice";
import { daySlotsForDuration, treatmentSlotsAfterPatchTest } from "@/lib/rules";
import { makeCategory, makeService, makeTech, makeWorkingHour } from "./fixtures";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("minNoticeHours helpers", () => {
  it("clamps to 0…168", () => {
    expect(clampMinNoticeHours(-3, 2)).toBe(0);
    expect(clampMinNoticeHours(200, 2)).toBe(168);
    expect(clampMinNoticeHours("4", 2)).toBe(4);
    expect(clampMinNoticeHours("nope", 2)).toBe(2);
  });

  it("treats missing tech notice as 0 (preserves current behaviour)", () => {
    expect(techMinNoticeHours({})).toBe(0);
    expect(techMinNoticeHours({ minNoticeHours: null })).toBe(0);
    expect(techMinNoticeHours({ minNoticeHours: 2 })).toBe(2);
  });

  it("lets a per-staff override win over the business default", () => {
    const tech = makeTech({ minNoticeHours: 4 });
    expect(effectiveMinNoticeHours(tech, { minNoticeHours: 1 })).toBe(1);
    expect(effectiveMinNoticeHours(tech, { minNoticeHours: 0 })).toBe(0);
    expect(effectiveMinNoticeHours(tech, { minNoticeHours: null })).toBe(4);
    expect(effectiveMinNoticeHours(tech, null)).toBe(4);
  });

  it("computes the notice floor from now + hours", () => {
    const now = Date.parse("2026-09-01T08:00:00.000Z");
    expect(minNoticeFloorMs(makeTech({ minNoticeHours: 2 }), null, now)).toBe(
      now + 2 * 60 * 60 * 1000,
    );
    expect(
      isInsideMinNoticeWindow(
        "2026-09-01T09:00:00.000Z",
        makeTech({ minNoticeHours: 2 }),
        null,
        now,
      ),
    ).toBe(true);
    expect(
      isInsideMinNoticeWindow(
        "2026-09-01T11:00:00.000Z",
        makeTech({ minNoticeHours: 2 }),
        null,
        now,
      ),
    ).toBe(false);
  });
});

describe("public slot generation respects min notice", () => {
  // 2026-09-01 is a Tuesday (weekday 2). Hours 09:00–17:00 London = 08:00–16:00Z (BST).
  const hours = [makeWorkingHour({ weekday: 2, startMinutes: 9 * 60, endMinutes: 17 * 60 })];
  const ctx = { tz: "Europe/London", workingHours: hours, timeOff: [], bookings: [] as never[] };

  it("with minNoticeHours=2, hides a slot 1h away and keeps a slot 3h away", () => {
    const now = Date.parse("2026-09-01T08:00:00.000Z"); // 09:00 London
    const floor = minNoticeFloorMs(makeTech({ minNoticeHours: 2 }), null, now);
    const slots = daySlotsForDuration(60, "2026-09-01", ctx, floor);
    // 10:00 London = 09:00Z — only 1h after now → inside notice window.
    expect(slots).not.toContain("2026-09-01T09:00:00.000Z");
    // 12:00 London = 11:00Z — 3h after now → bookable.
    expect(slots).toContain("2026-09-01T11:00:00.000Z");
  });

  it("minNoticeHours=0 preserves next-slot behaviour", () => {
    const now = Date.parse("2026-09-01T08:00:00.000Z");
    const floor = minNoticeFloorMs(makeTech({ minNoticeHours: 0 }), null, now);
    const slots = daySlotsForDuration(60, "2026-09-01", ctx, floor);
    expect(slots).toContain("2026-09-01T09:00:00.000Z");
  });

  it("applies the staff override when building the floor", () => {
    const now = Date.parse("2026-09-01T08:00:00.000Z");
    const tech = makeTech({ minNoticeHours: 4 });
    const staff = { minNoticeHours: 1 };
    const floor = minNoticeFloorMs(tech, staff, now);
    const slots = daySlotsForDuration(60, "2026-09-01", ctx, floor);
    // 1h override: 10:00 London (09:00Z) is still too soon (<= now+1h).
    expect(slots).not.toContain("2026-09-01T09:00:00.000Z");
    // 10:15 London = 09:15Z is after now+1h.
    expect(slots).toContain("2026-09-01T09:15:00.000Z");
  });

  it("stacks with patch-test lead time (later of the two wins)", () => {
    const now = Date.parse("2026-09-01T08:00:00.000Z");
    const floor = minNoticeFloorMs(makeTech({ minNoticeHours: 2 }), null, now);
    const patch = makeService({
      id: "svc_patch",
      isPatchTestService: true,
      durationMin: 15,
      requiresPatchTest: false,
    });
    const treatment = makeService({
      id: "svc_treat",
      requiresPatchTest: true,
      durationMin: 60,
    });
    // Patch at 09:00 London (08:00Z) — ends 08:15Z. Category lead 24h → earliest ~ next day.
    const category = makeCategory({ patchTestMinLeadHours: 24 });
    const days = treatmentSlotsAfterPatchTest(
      treatment,
      patch,
      "2026-09-01T08:00:00.000Z",
      category,
      ctx,
      14,
      floor,
    );
    const allSlots = days.flatMap((d) => d.slots);
    // Nothing on the patch day itself (24h lead dominates the 2h notice).
    expect(allSlots.every((s) => new Date(s).getTime() >= Date.parse("2026-09-02T08:15:00.000Z"))).toBe(
      true,
    );
    // And still not before the notice floor either (floor is earlier than patch lead here).
    expect(allSlots.every((s) => new Date(s).getTime() > floor)).toBe(true);
  });
});

describe("wiring: public only, dashboard unrestricted", () => {
  it("public page and actions apply minNoticeFloorMs at request time", () => {
    const page = read("app/[handle]/page.tsx");
    expect(page).toContain("minNoticeFloorMs");
    const actions = read("app/[handle]/actions.ts");
    expect(actions).toContain("minNoticeFloorMs");
    expect(actions).toContain("isInsideMinNoticeWindow");
    expect(actions).not.toContain("confirmOverbook");
  });

  it("dashboard manual / reschedule path keeps nowMs=0 (no min-notice floor)", () => {
    const dash = read("lib/booking/dashboard-slot.ts");
    expect(dash).toMatch(/daySlotsForDuration\([\s\S]*?,\s*0\s*\)/);
    expect(dash).not.toContain("minNoticeFloorMs");
    const manual = read("components/dashboard/manual-booking-form.tsx");
    expect(manual).not.toContain("minNoticeFloorMs");
  });

  it("settings and team expose the control; migration adds columns", () => {
    const settings = read("app/dashboard/settings/page.tsx");
    expect(settings).toContain('name="minNoticeHours"');
    expect(settings).toContain("Minimum notice to book online");
    const team = read("app/dashboard/team/page.tsx");
    expect(team).toContain('name="minNoticeHours"');
    const sql = read("supabase/migrations/0050_min_notice_hours.sql");
    expect(sql).toContain('add column if not exists "minNoticeHours"');
    expect(sql).toContain("staff_members");
    expect(sql).toMatch(/default 0/);
  });

  it("new signups start at 2 hours notice", () => {
    expect(read("lib/signup.ts")).toContain("minNoticeHours: 2");
  });
});
