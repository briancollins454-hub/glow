"use client";

import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/components/locale/locale-provider";
import {
  bookingPaymentSummary,
  isCompactPaymentIndicator,
  type BookingPaymentFields,
} from "@/lib/booking/payment-summary";

/**
 * Compact payment state for calendar blocks.
 * Full pill when there's room; accessible coloured dot on short bookings.
 */
export function BookingPaymentIndicator({
  booking,
  blockHeightPx,
  forceCompact = false,
  className = "",
}: {
  booking: BookingPaymentFields;
  /** Appointment block height in px; under threshold → compact dot. */
  blockHeightPx?: number;
  /** Narrow laned blocks force the dot even when height would allow a badge. */
  forceCompact?: boolean;
  className?: string;
}) {
  const currency = useCurrency();
  const summary = bookingPaymentSummary(booking, currency);
  const compact =
    forceCompact ||
    (typeof blockHeightPx === "number" ? isCompactPaymentIndicator(blockHeightPx) : false);

  const tone =
    summary.state === "paid" ? "green" : summary.state === "deposit_paid" ? "blue" : "amber";

  if (compact) {
    const dotClass =
      summary.state === "paid"
        ? "bg-success-text"
        : summary.state === "deposit_paid"
          ? "bg-info-text"
          : "bg-warning-text";
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={summary.ariaLabel}
        aria-label={summary.ariaLabel}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      </span>
    );
  }

  return (
    <Badge tone={tone} className={`px-1.5 py-0 text-[10px] leading-4 ${className}`}>
      {summary.shortLabel}
    </Badge>
  );
}
