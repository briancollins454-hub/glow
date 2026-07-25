/** Pixel scale for the staff day diary (minutes → vertical px). */
export const DAY_VIEW_PX_PER_MIN = 1.5;

/**
 * Below this content height: single line only (name + status dot).
 * At PX_PER_MIN=1.5 a 15-min block is ~28px after gaps.
 */
export const DAY_BLOCK_SINGLE_LINE_HEIGHT_PX = 34;

/** Below this (and not single-line): compact dots + optional time/service line. */
export const DAY_BLOCK_COMPACT_HEIGHT_PX = 48;

export type DayBlockDensity = "single" | "compact" | "full";

/**
 * How much chrome a day-view booking block can show without overflowing.
 * Narrow laned blocks always use dots for status/payment (width), never full badges.
 */
export function dayBlockDensity(opts: {
  contentHeightPx: number;
  laneCount: number;
}): { density: DayBlockDensity; useDots: boolean } {
  const narrow = opts.laneCount >= 2;
  if (opts.contentHeightPx < DAY_BLOCK_SINGLE_LINE_HEIGHT_PX) {
    return { density: "single", useDots: true };
  }
  if (opts.contentHeightPx < DAY_BLOCK_COMPACT_HEIGHT_PX || narrow) {
    return { density: "compact", useDots: true };
  }
  return { density: "full", useDots: false };
}
