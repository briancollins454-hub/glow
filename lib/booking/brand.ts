/** Shared brand colour helpers for public booking pages. */

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (r * percent) / 100)));
  g = Math.max(0, Math.min(255, Math.round(g + (g * percent) / 100)));
  b = Math.max(0, Math.min(255, Math.round(b + (b * percent) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dark ink used for text on light brand colours (matches the app's ink tone). */
const INK = "#1f1726";

function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). Unparseable input counts as dark. */
export function luminance(hex: string): number {
  const m = hex.replace("#", "");
  if (m.length !== 6) return 0;
  const num = parseInt(m, 16);
  if (Number.isNaN(num)) return 0;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b)
  );
}

/**
 * Readable text colour for content sitting ON the brand colour. Techs pick any
 * hex; pale palettes (cream, pastel pink, mint) made the old hard-coded white
 * text invisible. Picks white or dark ink, whichever has more WCAG contrast.
 */
export function onBrand(hex: string): string {
  const L = luminance(hex);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastInk = (L + 0.05) / (luminance(INK) + 0.05);
  return contrastWhite >= contrastInk ? "#ffffff" : INK;
}

/**
 * Brand colour safe to sit UNDER fixed white text (hero gradients, card
 * headers). Dark brands pass through untouched; light ones are darkened until
 * white text is comfortably readable, keeping the same hue.
 */
export function heroBrand(hex: string): string {
  let c = hex;
  for (let i = 0; i < 8 && luminance(c) > 0.25; i++) c = shade(c, -18);
  return c;
}
