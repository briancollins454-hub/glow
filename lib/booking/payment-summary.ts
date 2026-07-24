import { gbp } from "@/lib/format";
import type { BalanceStatus, DepositStatus } from "@/lib/db/types";

export type BookingPaymentFields = {
  depositPennies: number;
  depositStatus: DepositStatus;
  balancePennies: number;
  balanceStatus: BalanceStatus;
};

export type BookingPaymentSummary = {
  /** Visual state for pills / dots. */
  state: "paid" | "deposit_paid" | "due";
  /** Compact day-view label: Paid / Deposit paid / £X due */
  shortLabel: string;
  /** List-view wording (keeps existing copy). */
  listLabel: string;
  /** Total still owed (deposit unpaid + balance unpaid). */
  duePennies: number;
  /** Accessible label for compact (dot) variant. */
  ariaLabel: string;
};

/** Outstanding deposit + balance, same rules as Settle Up. */
export function bookingAmountDue(b: BookingPaymentFields): number {
  let due = 0;
  if (
    b.depositPennies > 0 &&
    b.depositStatus !== "paid" &&
    b.depositStatus !== "forfeited" &&
    b.depositStatus !== "refunded"
  ) {
    due += b.depositPennies;
  }
  if (
    b.balancePennies > 0 &&
    b.balanceStatus !== "paid" &&
    b.balanceStatus !== "refunded"
  ) {
    due += b.balancePennies;
  }
  return due;
}

/**
 * Shared payment derivation for list + calendar surfaces.
 * - Paid: balance settled (matches list "paid in full")
 * - Deposit paid: deposit recorded, balance still outstanding
 * - Due: anything still owed
 */
export function bookingPaymentSummary(b: BookingPaymentFields): BookingPaymentSummary {
  const duePennies = bookingAmountDue(b);
  const depositPaid =
    b.depositPennies > 0 &&
    b.depositStatus === "paid";
  const balanceOutstanding =
    b.balancePennies > 0 &&
    b.balanceStatus !== "paid" &&
    b.balanceStatus !== "refunded";

  if (b.balanceStatus === "paid") {
    return {
      state: "paid",
      shortLabel: "Paid",
      listLabel: "paid in full",
      duePennies: 0,
      ariaLabel: "Paid in full",
    };
  }

  if (depositPaid && balanceOutstanding) {
    return {
      state: "deposit_paid",
      shortLabel: "Deposit paid",
      listLabel: `${gbp(b.balancePennies)} due`,
      duePennies: b.balancePennies,
      ariaLabel: `Deposit paid, ${gbp(b.balancePennies)} still due`,
    };
  }

  return {
    state: "due",
    shortLabel: `${gbp(duePennies)} due`,
    listLabel: `${gbp(b.balancePennies)} due`,
    duePennies,
    ariaLabel: `${gbp(duePennies)} due`,
  };
}

/** Day-view blocks shorter than this (px) use a compact payment dot. */
export const COMPACT_PAYMENT_HEIGHT_PX = 48;

export function isCompactPaymentIndicator(blockHeightPx: number): boolean {
  return blockHeightPx < COMPACT_PAYMENT_HEIGHT_PX;
}
