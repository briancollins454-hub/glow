import { isLive } from "@/lib/subscriptions";
import type { Booking, ReminderKind, Tech } from "@/lib/db/types";

type MessagingTech = Pick<
  Tech,
  "subscriptionStatus" | "stripeSubscriptionId"
> & {
  clientMessagingConfirmedAt?: string | null;
  importedBookingRemindersOptIn?: boolean | null;
};

type MessagingBooking = Pick<Booking, "id"> & {
  importedAt?: string | null;
  importedBalanceRequestEnabled?: boolean | null;
};

/** Never started a Glow plan (evaluating / imported diary only). */
export function hasNeverSubscribed(
  tech: Pick<Tech, "subscriptionStatus" | "stripeSubscriptionId"> | null | undefined,
): boolean {
  if (!tech) return true;
  if (tech.subscriptionStatus !== "none") return false;
  return !tech.stripeSubscriptionId;
}

/**
 * Client-facing email/SMS is allowed when the salon is on a live plan, has
 * previously subscribed, or has explicitly confirmed client contact.
 * Never-subscribed accounts stay silent until confirmation.
 */
export function allowsClientFacingMessaging(
  tech: MessagingTech | null | undefined,
): boolean {
  if (!tech) return false;
  if (isLive(tech)) return true;
  if (tech.subscriptionStatus === "canceled" || tech.subscriptionStatus === "past_due") {
    return true;
  }
  if (tech.stripeSubscriptionId) return true;
  return !!tech.clientMessagingConfirmedAt;
}

export function isImportedBooking(
  booking: MessagingBooking | null | undefined,
): boolean {
  return !!booking?.importedAt;
}

/**
 * Whether this reminder kind may go out for this booking.
 * Imported bookings: reminders only after tech opt-in; balance only if
 * enabled on that booking. Native bookings follow the account messaging gate.
 */
export function maySendClientReminder(
  tech: MessagingTech | null | undefined,
  booking: MessagingBooking | null | undefined,
  kind: ReminderKind,
): boolean {
  if (!allowsClientFacingMessaging(tech)) return false;
  if (!isImportedBooking(booking)) return true;

  if (kind === "balance_request") {
    return !!booking?.importedBalanceRequestEnabled;
  }
  // confirmation / reminder_24h / reminder_2h / patch_test_retest
  if (kind === "patch_test_retest") return false;
  return !!tech?.importedBookingRemindersOptIn;
}

/** Rebook / marketing nudges must not use imported visit history without opt-in. */
export function maySendImportedClientMarketing(
  tech: MessagingTech | null | undefined,
  fromImportedBooking: boolean,
): boolean {
  if (!allowsClientFacingMessaging(tech)) return false;
  if (!fromImportedBooking) return true;
  return !!tech?.importedBookingRemindersOptIn;
}
