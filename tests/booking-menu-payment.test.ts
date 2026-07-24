import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOOKING_MENU_VIEWPORT_MARGIN,
  bookingMenuUsesBottomSheet,
  positionBookingMenu,
} from "@/lib/booking/menu-position";
import {
  COMPACT_PAYMENT_HEIGHT_PX,
  bookingAmountDue,
  bookingPaymentSummary,
  isCompactPaymentIndicator,
} from "@/lib/booking/payment-summary";
import type { BookingPaymentFields } from "@/lib/booking/payment-summary";

function payment(partial: Partial<BookingPaymentFields>): BookingPaymentFields {
  return {
    depositPennies: 0,
    depositStatus: "none",
    balancePennies: 0,
    balanceStatus: "unpaid",
    ...partial,
  };
}

describe("positionBookingMenu", () => {
  const trigger = { top: 500, bottom: 536, left: 200, right: 236, width: 36, height: 36 };

  it("opens downward when there is room below", () => {
    const pos = positionBookingMenu({
      trigger,
      menuHeight: 200,
      viewportWidth: 800,
      viewportHeight: 900,
    });
    expect(pos.openUp).toBe(false);
    expect(pos.top).toBe(trigger.bottom + 4);
    expect(pos.left + 256).toBeLessThanOrEqual(800 - BOOKING_MENU_VIEWPORT_MARGIN);
  });

  it("flips upward when the menu would extend past the bottom edge", () => {
    const nearBottom = { ...trigger, top: 700, bottom: 736 };
    const pos = positionBookingMenu({
      trigger: nearBottom,
      menuHeight: 260,
      viewportWidth: 400,
      viewportHeight: 800,
    });
    expect(pos.openUp).toBe(true);
    expect(pos.top).toBe(nearBottom.top - 4 - 260);
    expect(pos.top).toBeGreaterThanOrEqual(BOOKING_MENU_VIEWPORT_MARGIN);
    expect(pos.top + 260).toBeLessThanOrEqual(800 - BOOKING_MENU_VIEWPORT_MARGIN);
  });

  it("aligns to the right edge when it would overflow right", () => {
    const rightTrigger = { top: 100, bottom: 136, left: 350, right: 390, width: 40, height: 36 };
    const pos = positionBookingMenu({
      trigger: rightTrigger,
      menuHeight: 180,
      menuWidth: 256,
      viewportWidth: 400,
      viewportHeight: 800,
    });
    expect(pos.left + 256).toBeLessThanOrEqual(400 - BOOKING_MENU_VIEWPORT_MARGIN);
    expect(pos.left).toBeGreaterThanOrEqual(BOOKING_MENU_VIEWPORT_MARGIN);
  });

  it("keeps an 8px viewport margin when clamped", () => {
    const pos = positionBookingMenu({
      trigger: { top: 10, bottom: 46, left: 0, right: 36, width: 36, height: 36 },
      menuHeight: 900,
      viewportWidth: 320,
      viewportHeight: 500,
    });
    expect(pos.top).toBeGreaterThanOrEqual(BOOKING_MENU_VIEWPORT_MARGIN);
    expect(pos.left).toBeGreaterThanOrEqual(BOOKING_MENU_VIEWPORT_MARGIN);
  });
});

describe("bookingMenuUsesBottomSheet", () => {
  it("uses a bottom sheet below the sm breakpoint", () => {
    expect(bookingMenuUsesBottomSheet(375)).toBe(true);
    expect(bookingMenuUsesBottomSheet(639)).toBe(true);
    expect(bookingMenuUsesBottomSheet(640)).toBe(false);
    expect(bookingMenuUsesBottomSheet(1024)).toBe(false);
  });
});

describe("bookingPaymentSummary", () => {
  it("shows Paid when settled in full", () => {
    const s = bookingPaymentSummary(
      payment({
        depositPennies: 2500,
        depositStatus: "paid",
        balancePennies: 0,
        balanceStatus: "paid",
      }),
    );
    expect(s.state).toBe("paid");
    expect(s.shortLabel).toBe("Paid");
    expect(s.listLabel).toBe("paid in full");
    expect(s.duePennies).toBe(0);
  });

  it("shows Deposit paid when deposit is recorded and balance remains", () => {
    const s = bookingPaymentSummary(
      payment({
        depositPennies: 2000,
        depositStatus: "paid",
        balancePennies: 3500,
        balanceStatus: "unpaid",
      }),
    );
    expect(s.state).toBe("deposit_paid");
    expect(s.shortLabel).toBe("Deposit paid");
    expect(s.listLabel).toBe("£35.00 due");
    expect(s.duePennies).toBe(3500);
    expect(s.ariaLabel).toMatch(/Deposit paid/i);
  });

  it("shows £X due for unpaid / part-paid without a paid deposit", () => {
    const s = bookingPaymentSummary(
      payment({
        depositPennies: 1500,
        depositStatus: "none",
        balancePennies: 4000,
        balanceStatus: "unpaid",
      }),
    );
    expect(s.state).toBe("due");
    expect(s.shortLabel).toBe("£55.00 due");
    expect(s.duePennies).toBe(5500);
  });

  it("matches list-view due amount via bookingAmountDue", () => {
    const b = payment({
      depositPennies: 1000,
      depositStatus: "none",
      balancePennies: 2000,
      balanceStatus: "unpaid",
    });
    expect(bookingAmountDue(b)).toBe(3000);
    expect(bookingPaymentSummary(b).duePennies).toBe(3000);
  });
});

describe("compact payment indicator", () => {
  it("uses compact dot on short 15/30 minute blocks", () => {
    expect(isCompactPaymentIndicator(28)).toBe(true);
    expect(isCompactPaymentIndicator(34)).toBe(true);
    expect(isCompactPaymentIndicator(COMPACT_PAYMENT_HEIGHT_PX)).toBe(false);
    expect(isCompactPaymentIndicator(80)).toBe(false);
  });
});

describe("booking actions menu wiring", () => {
  const src = readFileSync(join(process.cwd(), "components/dashboard/booking-actions.tsx"), "utf8");

  it("renders the menu in a portal on document.body", () => {
    expect(src).toContain("createPortal");
    expect(src).toContain("document.body");
    expect(src).toContain("positionBookingMenu");
    expect(src).toContain("fixed");
  });

  it("supports bottom sheet on mobile and dropdown on desktop", () => {
    expect(src).toContain("bookingMenuUsesBottomSheet");
    expect(src).toContain("data-booking-menu-sheet");
    expect(src).toContain("data-booking-menu-dropdown");
    expect(src).toContain("Close");
  });

  it("keeps one-open, click-outside, Escape, and focus return", () => {
    expect(src).toContain("broadcastActiveMenu");
    expect(src).toContain("pointerdown");
    expect(src).toContain('Escape');
    expect(src).toContain("triggerRef.current?.focus()");
    expect(src).toContain("z-[200]");
  });
});

describe("day / month payment indicator wiring", () => {
  it("day view blocks render BookingPaymentIndicator with height for compact mode", () => {
    const day = readFileSync(
      join(process.cwd(), "components/dashboard/bookings-staff-day-view.tsx"),
      "utf8",
    );
    expect(day).toContain("BookingPaymentIndicator");
    expect(day).toContain("blockHeightPx");
    expect(day).toContain("BookingActions");
  });

  it("month day drawer lists the payment indicator", () => {
    const month = readFileSync(
      join(process.cwd(), "components/dashboard/bookings-month-calendar.tsx"),
      "utf8",
    );
    expect(month).toContain("BookingPaymentIndicator");
  });

  it("list view uses shared bookingPaymentSummary for due copy", () => {
    const list = readFileSync(join(process.cwd(), "app/dashboard/bookings/page.tsx"), "utf8");
    expect(list).toContain("bookingPaymentSummary");
    expect(list).toContain("listLabel");
  });
});
