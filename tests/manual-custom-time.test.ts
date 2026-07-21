import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("manual booking custom time (deliberate overbooking)", () => {
  it("date-time picker offers a custom time mode with a flag input", () => {
    const src = read("components/dashboard/date-time-picker.tsx");
    expect(src).toContain("allowCustomTime");
    expect(src).toContain('name="customTime" value="1"');
    expect(src).toContain('type="time"');
  });

  it("manual booking form enables custom time; online booking components do not", () => {
    const form = read("components/dashboard/manual-booking-form.tsx");
    expect(form).toContain("allowCustomTime");
    const online = read("components/booking/booking-step-interactive.tsx");
    expect(online).not.toContain("allowCustomTime");
  });

  it("the server action skips the free-slot check only for the custom flag", () => {
    const actions = read("app/dashboard/actions.ts");
    expect(actions).toContain('formData.get("customTime")');
    expect(actions).toMatch(/if \(!customTime\) \{/);
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
