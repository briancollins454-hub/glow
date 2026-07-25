import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAY_BLOCK_COMPACT_HEIGHT_PX,
  DAY_BLOCK_SINGLE_LINE_HEIGHT_PX,
  DAY_VIEW_PX_PER_MIN,
  dayBlockDensity,
} from "@/lib/booking/day-block-layout";
import {
  optionLabel,
  selectedTakenSuffix,
  takenSlotBookedLabel,
} from "@/lib/booking/taken-slot-label";

describe("dayBlockDensity", () => {
  it("uses a single line for very short 15-min blocks", () => {
    const contentHeight = Math.max(28, 15 * DAY_VIEW_PX_PER_MIN - 2);
    expect(contentHeight).toBeLessThan(DAY_BLOCK_SINGLE_LINE_HEIGHT_PX);
    expect(dayBlockDensity({ contentHeightPx: contentHeight, laneCount: 1 })).toEqual({
      density: "single",
      useDots: true,
    });
  });

  it("uses compact dots for 30-min blocks without spilling to full badges", () => {
    const contentHeight = Math.max(28, 30 * DAY_VIEW_PX_PER_MIN - 2);
    expect(contentHeight).toBeGreaterThanOrEqual(DAY_BLOCK_SINGLE_LINE_HEIGHT_PX);
    expect(contentHeight).toBeLessThan(DAY_BLOCK_COMPACT_HEIGHT_PX);
    expect(dayBlockDensity({ contentHeightPx: contentHeight, laneCount: 1 })).toEqual({
      density: "compact",
      useDots: true,
    });
  });

  it("uses the full badge layout for tall single-lane blocks", () => {
    const contentHeight = Math.max(28, 60 * DAY_VIEW_PX_PER_MIN - 2);
    expect(contentHeight).toBeGreaterThanOrEqual(DAY_BLOCK_COMPACT_HEIGHT_PX);
    expect(dayBlockDensity({ contentHeightPx: contentHeight, laneCount: 1 })).toEqual({
      density: "full",
      useDots: false,
    });
  });

  it("forces dots on narrow 2- and 3-lane blocks even when tall", () => {
    const tall = 90;
    expect(dayBlockDensity({ contentHeightPx: tall, laneCount: 2 })).toEqual({
      density: "compact",
      useDots: true,
    });
    expect(dayBlockDensity({ contentHeightPx: tall, laneCount: 3 })).toEqual({
      density: "compact",
      useDots: true,
    });
  });
});

describe("taken slot display labels", () => {
  it("shows Booked (Full Name) in the dropdown, not a lone initial", () => {
    expect(
      optionLabel({
        time: "15:00",
        takenName: "Sophie Turner",
        takenInitial: "S",
        overrideReason: "conflict",
      }),
    ).toBe("15:00 · Booked (Sophie Turner)");
  });

  it("falls back to the initial, then to a plain Booked label", () => {
    expect(takenSlotBookedLabel({ takenInitial: "C" })).toBe("Booked (C)");
    expect(optionLabel({ time: "15:00", takenInitial: "C", overrideReason: "conflict" })).toBe(
      "15:00 · Booked (C)",
    );
    expect(optionLabel({ time: "15:00", overrideReason: "conflict" })).toBe("15:00 · Booked");
    expect(optionLabel({ time: "15:00" })).toBe("15:00");
  });

  it("uses booked: Full Name as the selected-slot suffix", () => {
    expect(selectedTakenSuffix({ takenName: "Sophie Turner", takenInitial: "S" })).toBe(
      "booked: Sophie Turner",
    );
    expect(selectedTakenSuffix({ takenInitial: "C" })).toBe("booked: C");
    expect(selectedTakenSuffix({})).toBeNull();
  });

  it("picker wires the shared label helpers", () => {
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/date-time-picker.tsx"),
      "utf8",
    );
    expect(src).toContain("optionLabel");
    expect(src).toContain("selectedTakenSuffix");
    expect(src).toContain("@/lib/booking/taken-slot-label");
  });
});
