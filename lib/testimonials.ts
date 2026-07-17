/** Max imported testimonials a tech may keep. Enforced in app logic, not the DB. */
export const TESTIMONIAL_CAP = 15;

/** Default visibility window when creating or importing a testimonial. */
export const TESTIMONIAL_DEFAULT_MONTHS = 6;

export function defaultTestimonialShowUntil(from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + TESTIMONIAL_DEFAULT_MONTHS);
  return d.toISOString();
}

export function isTestimonialVisible(
  t: { showUntil: string | null },
  now = new Date(),
): boolean {
  if (!t.showUntil) return true;
  return new Date(t.showUntil).getTime() > now.getTime();
}

export function parseTestimonialRating(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}
