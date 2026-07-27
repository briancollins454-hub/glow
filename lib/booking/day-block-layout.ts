/** Day-view vertical zoom (px per minute of clock time). */
export type DayViewZoom = "compact" | "comfortable" | "spacious";

export const DAY_VIEW_ZOOM_LEVELS: DayViewZoom[] = ["compact", "comfortable", "spacious"];

export const DAY_VIEW_ZOOM_STORAGE_KEY = "glow-day-view-zoom";

/** Comfortable is the new default (larger than the old fixed 1.5). */
export const DEFAULT_DAY_VIEW_ZOOM: DayViewZoom = "comfortable";

export const DAY_VIEW_PX_PER_MIN_BY_ZOOM: Record<DayViewZoom, number> = {
  compact: 1.2,
  comfortable: 1.8,
  spacious: 2.6,
};

/** @deprecated Prefer DAY_VIEW_PX_PER_MIN_BY_ZOOM[zoom]; kept as the default scale. */
export const DAY_VIEW_PX_PER_MIN = DAY_VIEW_PX_PER_MIN_BY_ZOOM[DEFAULT_DAY_VIEW_ZOOM];

export const DAY_VIEW_ZOOM_LABELS: Record<DayViewZoom, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

/**
 * Below this content height (inclusive): single line only (name + status dot).
 * Threshold is height-based so Spacious 30-min blocks can show full chrome while
 * Compact 30-min blocks stay single-line.
 */
export const DAY_BLOCK_SINGLE_LINE_HEIGHT_PX = 34;

/** Below this (and not single-line): compact dots + optional time/service line. */
export const DAY_BLOCK_COMPACT_HEIGHT_PX = 48;

export type DayBlockDensity = "single" | "compact" | "full";

export function isDayViewZoom(value: unknown): value is DayViewZoom {
  return value === "compact" || value === "comfortable" || value === "spacious";
}

export function normalizeDayViewZoom(value: unknown): DayViewZoom {
  return isDayViewZoom(value) ? value : DEFAULT_DAY_VIEW_ZOOM;
}

export function pxPerMinForZoom(zoom: DayViewZoom): number {
  return DAY_VIEW_PX_PER_MIN_BY_ZOOM[normalizeDayViewZoom(zoom)];
}

/** Top offset of a minute-of-day within the diary window. */
export function dayViewOffsetPx(
  minutesFromMidnight: number,
  windowStartMin: number,
  pxPerMin: number,
): number {
  return (minutesFromMidnight - windowStartMin) * pxPerMin;
}

/** Rendered height for a span of minutes (bookings use a 28px floor). */
export function dayViewSpanHeightPx(
  spanMin: number,
  pxPerMin: number,
  opts?: { minPx?: number; gapPx?: number },
): number {
  const minPx = opts?.minPx ?? 28;
  const gapPx = opts?.gapPx ?? 2;
  return Math.max(minPx, spanMin * pxPerMin - gapPx);
}

/**
 * How much chrome a day-view booking block can show without overflowing.
 * Keys off rendered height (not duration) so zoom changes the layout mode.
 * Narrow laned blocks always use dots for status/payment (width), never full badges.
 */
export function dayBlockDensity(opts: {
  contentHeightPx: number;
  laneCount: number;
}): { density: DayBlockDensity; useDots: boolean } {
  const narrow = opts.laneCount >= 2;
  if (opts.contentHeightPx <= DAY_BLOCK_SINGLE_LINE_HEIGHT_PX) {
    return { density: "single", useDots: true };
  }
  if (opts.contentHeightPx < DAY_BLOCK_COMPACT_HEIGHT_PX || narrow) {
    return { density: "compact", useDots: true };
  }
  return { density: "full", useDots: false };
}

export function readStoredDayViewZoom(): DayViewZoom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAY_VIEW_ZOOM_STORAGE_KEY);
    return isDayViewZoom(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredDayViewZoom(zoom: DayViewZoom): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DAY_VIEW_ZOOM_STORAGE_KEY, normalizeDayViewZoom(zoom));
  } catch {
    /* private mode */
  }
}

export function cycleDayViewZoom(current: DayViewZoom, delta: 1 | -1): DayViewZoom {
  const idx = DAY_VIEW_ZOOM_LEVELS.indexOf(normalizeDayViewZoom(current));
  const next = (idx + delta + DAY_VIEW_ZOOM_LEVELS.length) % DAY_VIEW_ZOOM_LEVELS.length;
  return DAY_VIEW_ZOOM_LEVELS[next]!;
}
