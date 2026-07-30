/**
 * Fixed palette for category colour coding in the diary. Techs pick from
 * these named swatches only (stored as the id, never free-form hex), so
 * every colour is pre-checked for readability on the light diary background
 * and stays distinguishable from the pink brand accent.
 */

import type { Service, ServiceCategory } from "@/lib/db/types";

export type CategoryColour = {
  /** Stored on categories.colour. */
  id: string;
  label: string;
  /** Solid colour for strips, dots, swatches and the legend. */
  hex: string;
};

export const CATEGORY_PALETTE: CategoryColour[] = [
  { id: "sky", label: "Sky", hex: "#0369a1" },
  { id: "teal", label: "Teal", hex: "#0f766e" },
  { id: "green", label: "Green", hex: "#15803d" },
  { id: "olive", label: "Olive", hex: "#4d7c0f" },
  { id: "amber", label: "Amber", hex: "#b45309" },
  { id: "terracotta", label: "Terracotta", hex: "#c2410c" },
  { id: "cocoa", label: "Cocoa", hex: "#7c2d12" },
  { id: "indigo", label: "Indigo", hex: "#4338ca" },
  { id: "violet", label: "Violet", hex: "#6d28d9" },
  { id: "navy", label: "Navy", hex: "#1e3a8a" },
  { id: "slate", label: "Slate", hex: "#475569" },
];

const BY_ID = new Map(CATEGORY_PALETTE.map((c) => [c.id, c]));

/** Resolve a stored colour id; unknown/null → null (renders as before). */
export function paletteColour(id: string | null | undefined): CategoryColour | null {
  return (id && BY_ID.get(id)) || null;
}

export function isPaletteColourId(id: string): boolean {
  return BY_ID.has(id);
}

// ---------------- Contrast maths (WCAG) ----------------

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_TEXT = "#1f1726";
const LIGHT_TEXT = "#ffffff";

/**
 * Text colour for a solid palette background — computed, never assumed.
 * Tests assert the winner meets 4.5:1 on every palette colour.
 */
export function textOn(hex: string): string {
  return contrastRatio(DARK_TEXT, hex) >= contrastRatio(LIGHT_TEXT, hex)
    ? DARK_TEXT
    : LIGHT_TEXT;
}

/** Solid colour with alpha, e.g. borders. */
export function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Pale wash for whole booking blocks. The block keeps its normal dark text
 * and badges (colour is decoration, never the sole carrier of information),
 * so the wash must stay light — tests assert dark text still meets 4.5:1 on
 * the effective colour over a white diary background.
 */
export function blockTint(hex: string): string {
  return hexAlpha(hex, 0.14);
}

/** The tint composited onto white — used by tests to verify text contrast. */
export function blockTintOnWhite(hex: string, alpha = 0.14): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(alpha * c + (1 - alpha) * 255);
  const to2 = (c: number) => c.toString(16).padStart(2, "0");
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

// ---------------- Lookup helpers ----------------

/**
 * serviceId → palette hex for diary views. Services whose category has no
 * colour are simply absent, so those blocks render exactly as before.
 */
export function serviceColourMap(
  services: Pick<Service, "id" | "categoryId">[],
  categories: Pick<ServiceCategory, "id" | "colour">[],
): Record<string, string> {
  const catColour = new Map(
    categories.map((c) => [c.id, paletteColour(c.colour)?.hex ?? null]),
  );
  const map: Record<string, string> = {};
  for (const s of services) {
    const hex = catColour.get(s.categoryId);
    if (hex) map[s.id] = hex;
  }
  return map;
}

/** Categories with a colour, for the diary legend. */
export function legendEntries(
  categories: Pick<ServiceCategory, "id" | "name" | "colour">[],
): { id: string; name: string; hex: string }[] {
  return categories
    .map((c) => {
      const colour = paletteColour(c.colour);
      return colour ? { id: c.id, name: c.name, hex: colour.hex } : null;
    })
    .filter((c): c is { id: string; name: string; hex: string } => !!c);
}
