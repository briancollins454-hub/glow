import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CATEGORY_PALETTE,
  blockTintOnWhite,
  contrastRatio,
  isPaletteColourId,
  legendEntries,
  paletteColour,
  serviceColourMap,
  textOn,
} from "@/lib/category-colours";
import { makeService } from "./fixtures";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function makeCategory(overrides: { id: string; colour?: string | null; name?: string }) {
  return { id: overrides.id, name: overrides.name ?? "Lashes", colour: overrides.colour ?? null };
}

describe("palette", () => {
  it("has 10–12 fixed colours with unique ids and hexes", () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(10);
    expect(CATEGORY_PALETTE.length).toBeLessThanOrEqual(12);
    expect(new Set(CATEGORY_PALETTE.map((c) => c.id)).size).toBe(CATEGORY_PALETTE.length);
    expect(new Set(CATEGORY_PALETTE.map((c) => c.hex)).size).toBe(CATEGORY_PALETTE.length);
  });

  it("every colour is distinguishable from the pink brand accent", () => {
    // Not a colour-science measure, but a hard floor: none of the palette
    // equals or nearly equals #db2777.
    for (const c of CATEGORY_PALETTE) {
      expect(c.hex.toLowerCase()).not.toBe("#db2777");
      expect(contrastRatio(c.hex, "#db2777")).not.toBeCloseTo(1, 2);
    }
  });

  it("rejects free-form hex — only palette ids validate", () => {
    expect(isPaletteColourId("teal")).toBe(true);
    expect(isPaletteColourId("#ff0000")).toBe(false);
    expect(isPaletteColourId("hotpink")).toBe(false);
    expect(paletteColour("#ff0000")).toBeNull();
    expect(paletteColour(null)).toBeNull();
  });
});

describe("readability rules", () => {
  it("computed text colour meets 4.5:1 on every solid palette colour", () => {
    for (const c of CATEGORY_PALETTE) {
      const text = textOn(c.hex);
      expect(contrastRatio(text, c.hex)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark ink text meets 4.5:1 on every block tint over the light diary background", () => {
    for (const c of CATEGORY_PALETTE) {
      const effective = blockTintOnWhite(c.hex);
      expect(contrastRatio("#1f1726", effective)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("serviceColourMap", () => {
  const categories = [
    makeCategory({ id: "cat_lashes", colour: "teal" }),
    makeCategory({ id: "cat_nails", colour: null }),
    makeCategory({ id: "cat_brows", colour: "not-a-palette-id" }),
  ];
  const services = [
    makeService({ id: "svc_lash", categoryId: "cat_lashes" }),
    makeService({ id: "svc_nail", categoryId: "cat_nails" }),
    makeService({ id: "svc_brow", categoryId: "cat_brows" }),
  ];

  it("maps coloured categories and leaves uncoloured ones absent (renders as before)", () => {
    const map = serviceColourMap(services, categories);
    expect(map.svc_lash).toBe(paletteColour("teal")!.hex);
    expect(map.svc_nail).toBeUndefined();
    // Unknown stored value behaves like no colour rather than crashing.
    expect(map.svc_brow).toBeUndefined();
  });

  it("legend lists only coloured categories", () => {
    const entries = legendEntries(categories);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "cat_lashes", hex: paletteColour("teal")!.hex });
  });
});

describe("colour application across views", () => {
  it("day view blocks apply the wash + strip only when a colour exists", () => {
    const src = read("components/dashboard/bookings-staff-day-view.tsx");
    expect(src).toContain("colourByServiceId[b.serviceId]");
    expect(src).toContain("blockTint(colour)");
    expect(src).toMatch(/\.\.\.\(colour\s*\?/);
    // Colour never touches layout (top/height/left/width stay unconditional).
  });

  it("month view shows category dots in day cells and the day list", () => {
    const src = read("components/dashboard/bookings-month-calendar.tsx");
    expect(src).toContain("colourByServiceId");
    expect((src.match(/colourByServiceId\[b\.serviceId\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("bookings list rows show a colour indicator, but never for cancelled bookings", () => {
    const src = read("app/dashboard/bookings/page.tsx");
    expect(src).toContain('colourByServiceId[b.serviceId] && b.status !== "cancelled"');
  });

  it("day and month views exclude cancelled bookings entirely (muted treatment preserved)", () => {
    // Day view filters through activeBookingsOnDate (status !== cancelled);
    // month view groups through activeBookings with the same filter.
    expect(read("lib/booking/staff-day.ts")).toContain('b.status !== "cancelled"');
    expect(read("components/dashboard/bookings-month-calendar.tsx")).toContain(
      'b.status !== "cancelled"',
    );
  });

  it("blocked time and unavailable bands keep their existing treatment", () => {
    const src = read("components/dashboard/bookings-staff-day-view.tsx");
    // CalendarManualBlock / CalendarRotaUnavailable get no colour props.
    expect(src).not.toMatch(/CalendarManualBlock[\s\S]{0,200}colour/);
    expect(src).not.toMatch(/CalendarRotaUnavailable[\s\S]{0,200}colour/);
  });

  it("categories without a colour render exactly as before (no style override)", () => {
    const src = read("components/dashboard/bookings-staff-day-view.tsx");
    expect(src).toContain(": {})");
    // The base classes are unchanged from the pre-colour implementation.
    expect(src).toContain("rounded-lg border border-brand-400/50 bg-surface shadow-sm");
  });
});
