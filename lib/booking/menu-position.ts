/** Pure positioning helpers for the booking actions menu portal. */

export const BOOKING_MENU_VIEWPORT_MARGIN = 8;
export const BOOKING_MENU_WIDTH = 256; // Tailwind w-64
export const BOOKING_MENU_GAP = 4;

export type MenuCoords = {
  top: number;
  left: number;
  /** True when the menu opens above the trigger. */
  openUp: boolean;
};

/**
 * Place a fixed dropdown from the trigger's bounding rect.
 * Flips upward when it would overflow the bottom; clamps horizontally
 * with an 8px viewport margin (right-aligns to the trigger by default).
 */
export function positionBookingMenu(input: {
  trigger: { top: number; bottom: number; left: number; right: number; width: number; height: number };
  menuHeight: number;
  menuWidth?: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}): MenuCoords {
  const margin = input.margin ?? BOOKING_MENU_VIEWPORT_MARGIN;
  const gap = input.gap ?? BOOKING_MENU_GAP;
  const menuWidth = input.menuWidth ?? BOOKING_MENU_WIDTH;
  const { trigger, menuHeight, viewportWidth, viewportHeight } = input;

  let openUp = false;
  let top = trigger.bottom + gap;

  if (top + menuHeight > viewportHeight - margin) {
    const upTop = trigger.top - gap - menuHeight;
    if (upTop >= margin) {
      openUp = true;
      top = upTop;
    } else {
      top = Math.max(margin, viewportHeight - margin - menuHeight);
    }
  }
  if (top < margin) top = margin;

  // Prefer right-aligned to the trigger (historical `right-0` menu).
  let left = trigger.right - menuWidth;
  if (left + menuWidth > viewportWidth - margin) {
    left = viewportWidth - margin - menuWidth;
  }
  if (left < margin) left = margin;

  return { top, left, openUp };
}

/** Match Tailwind `sm` (640px): below this, use a bottom sheet. */
export const BOOKING_MENU_SHEET_MAX_WIDTH = 639;

export function bookingMenuUsesBottomSheet(viewportWidth: number): boolean {
  return viewportWidth <= BOOKING_MENU_SHEET_MAX_WIDTH;
}
