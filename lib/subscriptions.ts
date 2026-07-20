import type { SubscriptionStatus, Tech } from "@/lib/db/types";

const LIVE_STATUSES: SubscriptionStatus[] = ["trialing", "active", "comped"];

/** True when the tech has an active Glow plan (subscribed / trialing / comped). */
export function isLive(tech: Pick<Tech, "subscriptionStatus">): boolean {
  return LIVE_STATUSES.includes(tech.subscriptionStatus);
}

/**
 * True when the public booking page can take new appointments.
 * Needs an active plan AND bookingPageLive (Settings toggle).
 * Missing/null bookingPageLive is treated as on (pre-migration).
 */
export function acceptsOnlineBookings(
  tech: Pick<Tech, "subscriptionStatus"> & { bookingPageLive?: boolean | null },
): boolean {
  if (!isLive(tech)) return false;
  return tech.bookingPageLive !== false;
}

/** True when the tech can accept card payments from clients (Stripe Connect ready). */
export function isPaymentsReady(tech: Pick<Tech, "connectChargesEnabled">): boolean {
  return !!tech.connectChargesEnabled;
}

/**
 * True when this tech protects against no-shows by saving the client's card at
 * booking (nothing charged upfront) instead of taking a deposit. Only takes
 * effect when Stripe payments are ready.
 */
export function usesCardCapture(
  tech: Pick<Tech, "connectChargesEnabled"> & { noShowProtection?: Tech["noShowProtection"] },
): boolean {
  return tech.noShowProtection === "card_capture" && isPaymentsReady(tech);
}

export function planLabel(tech: Pick<Tech, "plan" | "subscriptionStatus">): string {
  if (tech.subscriptionStatus === "comped") return "Complimentary";
  if (tech.plan === "annual") return "Annual (£180/yr)";
  if (tech.plan === "monthly") return "Monthly (£19/mo)";
  return "No plan";
}
