import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAY_BLOCK_COMPACT_HEIGHT_PX,
  DAY_BLOCK_SINGLE_LINE_HEIGHT_PX,
  DAY_VIEW_PX_PER_MIN_BY_ZOOM,
  DAY_VIEW_ZOOM_STORAGE_KEY,
  DEFAULT_DAY_VIEW_ZOOM,
  cycleDayViewZoom,
  dayBlockDensity,
  dayViewOffsetPx,
  dayViewSpanHeightPx,
  normalizeDayViewZoom,
  pxPerMinForZoom,
  readStoredDayViewZoom,
  writeStoredDayViewZoom,
} from "@/lib/booking/day-block-layout";
import {
  optionLabel,
  selectedTakenSuffix,
  takenSlotBookedLabel,
} from "@/lib/booking/taken-slot-label";

describe("day view zoom scale", () => {
  it("exposes Compact / Comfortable / Spacious px-per-min values", () => {
    expect(DAY_VIEW_PX_PER_MIN_BY_ZOOM).toEqual({
      compact: 1.2,
      comfortable: 1.8,
      spacious: 2.6,
    });
    expect(DEFAULT_DAY_VIEW_ZOOM).toBe("comfortable");
    expect(pxPerMinForZoom("compact")).toBe(1.2);
    expect(pxPerMinForZoom("spacious")).toBe(2.6);
    expect(normalizeDayViewZoom("nope")).toBe("comfortable");
  });

  it("scales block tops and heights with the active px-per-min", () => {
    const windowStart = 9 * 60;
    for (const zoom of ["compact", "comfortable", "spacious"] as const) {
      const ppm = pxPerMinForZoom(zoom);
      const top = dayViewOffsetPx(10 * 60, windowStart, ppm);
      const height = dayViewSpanHeightPx(60, ppm);
      expect(top).toBe(60 * ppm);
      expect(height).toBe(60 * ppm - 2);
      // Hour gridline at 10:00 aligns with a booking that starts then.
      expect(dayViewOffsetPx(10 * 60, windowStart, ppm)).toBe(top);
    }
  });

  it("cycles zoom levels with +/- steppers", () => {
    expect(cycleDayViewZoom("compact", 1)).toBe("comfortable");
    expect(cycleDayViewZoom("comfortable", 1)).toBe("spacious");
    expect(cycleDayViewZoom("spacious", 1)).toBe("compact");
    expect(cycleDayViewZoom("comfortable", -1)).toBe("compact");
  });
});

describe("dayBlockDensity keys off rendered height (zoom-aware)", () => {
  it("30-min booking is single-line at Compact and full at Spacious", () => {
    const compactH = dayViewSpanHeightPx(30, pxPerMinForZoom("compact"));
    const spaciousH = dayViewSpanHeightPx(30, pxPerMinForZoom("spacious"));
    expect(compactH).toBeLessThanOrEqual(DAY_BLOCK_SINGLE_LINE_HEIGHT_PX);
    expect(spaciousH).toBeGreaterThanOrEqual(DAY_BLOCK_COMPACT_HEIGHT_PX);
    expect(dayBlockDensity({ contentHeightPx: compactH, laneCount: 1 })).toEqual({
      density: "single",
      useDots: true,
    });
    expect(dayBlockDensity({ contentHeightPx: spaciousH, laneCount: 1 })).toEqual({
      density: "full",
      useDots: false,
    });
  });

  it("15-min stays single-line even at Spacious when under the height floor", () => {
    // min height floor is 28px; 15 * 2.6 - 2 = 37 → compact (dots), not single
    const h = dayViewSpanHeightPx(15, pxPerMinForZoom("spacious"));
    expect(h).toBeGreaterThan(DAY_BLOCK_SINGLE_LINE_HEIGHT_PX);
    expect(h).toBeLessThan(DAY_BLOCK_COMPACT_HEIGHT_PX);
    expect(dayBlockDensity({ contentHeightPx: h, laneCount: 1 }).density).toBe("compact");
  });

  it("uses compact dots for mid-height single-lane blocks", () => {
    expect(
      dayBlockDensity({
        contentHeightPx: DAY_BLOCK_SINGLE_LINE_HEIGHT_PX + 1,
        laneCount: 1,
      }),
    ).toEqual({ density: "compact", useDots: true });
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

describe("day view zoom persistence", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the chosen zoom across reload via localStorage", () => {
    expect(readStoredDayViewZoom()).toBeNull();
    writeStoredDayViewZoom("spacious");
    expect(store.get(DAY_VIEW_ZOOM_STORAGE_KEY)).toBe("spacious");
    expect(readStoredDayViewZoom()).toBe("spacious");
  });
});

describe("day view zoom wiring", () => {
  it("day view derives all geometry from the active pxPerMin and shows the zoom control", () => {
    const day = readFileSync(
      join(process.cwd(), "components/dashboard/bookings-staff-day-view.tsx"),
      "utf8",
    );
    expect(day).toContain("useDayViewZoom");
    expect(day).toContain("DayViewZoomControl");
    expect(day).toContain("dayViewOffsetPx");
    expect(day).toContain("dayViewSpanHeightPx");
    expect(day).toContain("pxPerMin");
    expect(day).not.toMatch(/PX_PER_MIN\s*=\s*1\./);
    expect(day).toContain("overflow-hidden");
  });

  it("zoom control is labelled for accessibility and persists via the shared helper", () => {
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/day-view-zoom-control.tsx"),
      "utf8",
    );
    expect(src).toContain('aria-label="Calendar zoom"');
    expect(src).toContain("Zoom out");
    expect(src).toContain("Zoom in");
    expect(src).toContain("writeStoredDayViewZoom");
    expect(src).toContain("readStoredDayViewZoom");
    const layout = readFileSync(join(process.cwd(), "lib/booking/day-block-layout.ts"), "utf8");
    expect(layout).toContain(DAY_VIEW_ZOOM_STORAGE_KEY);
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
