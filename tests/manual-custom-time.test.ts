import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("manual booking deliberate overbook (confirm path)", () => {
  it("date-time picker requires named-conflict confirmation instead of free custom time", () => {
    const src = read("components/dashboard/date-time-picker.tsx");
    expect(src).toContain('name="confirmOverbook" value="1"');
    expect(src).toContain("This slot is taken by");
    expect(src).not.toContain("allowCustomTime");
    expect(src).not.toContain('name="customTime"');
  });

  it("manual booking form shows taken slots; online booking does not offer overbook", () => {
    const form = read("components/dashboard/manual-booking-form.tsx");
    expect(form).toContain("daySlotChoicesForDuration");
    expect(form).toContain("takenInitial");
    const online = read("components/booking/booking-step-interactive.tsx");
    expect(online).not.toContain("confirmOverbook");
    expect(online).not.toContain("allowCustomTime");
  });

  it("the server action only skips the free-slot block when overbook is confirmed", () => {
    const actions = read("app/dashboard/actions.ts");
    const start = actions.indexOf("export async function addManualBookingAction");
    const end = actions.indexOf("export async function rescheduleBookingAction", start);
    const fn = actions.slice(start, end);
    expect(fn).toContain('formData.get("confirmOverbook")');
    expect(fn).toContain("allowOverlap = true");
    expect(fn).not.toContain("customTime");
  });
});

describe("mobile width safety", () => {
  it("dashboard shell and manual form use explicit mobile column templates", () => {
    expect(read("components/dashboard/dashboard-shell.tsx")).toContain(
      "grid grid-cols-1 gap-6",
    );
    expect(read("components/dashboard/manual-booking-form.tsx")).toContain(
      "grid grid-cols-1 gap-3 sm:grid-cols-2",
    );
  });

  it("cards can never force the page wider than the screen", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.card \{[^}]*max-w-full/s);
    expect(css).toMatch(/\.card \{[^}]*min-width: 0/s);
  });
});
