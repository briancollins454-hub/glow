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
 * Salon master switch: when false, clients are never asked to pay online
 * (even if Stripe is connected and services have deposits configured).
 * Missing / null = on (pre-0051 migration).
 */
export function salonTakesClientPayments(
  tech: { clientPaymentsEnabled?: boolean | null } | null | undefined,
): boolean {
  return tech?.clientPaymentsEnabled !== false;
}

/**
 * True when this tech protects against no-shows by saving the client's card at
 * booking (nothing charged upfront) instead of taking a deposit. Only takes
 * effect when the salon takes client payments and Stripe is ready.
 */
export function usesCardCapture(
  tech: Pick<Tech, "connectChargesEnabled"> & {
    noShowProtection?: Tech["noShowProtection"];
    clientPaymentsEnabled?: boolean | null;
  },
): boolean {
  return (
    tech.noShowProtection === "card_capture" &&
    salonTakesClientPayments(tech) &&
    isPaymentsReady(tech)
  );
}

/**
 * True when an online deposit / card-capture / balance checkout may run.
 * Requires both the salon switch and a charges-enabled Connect account.
 */
export function clientOnlinePaymentsActive(
  tech: Pick<Tech, "connectChargesEnabled"> & { clientPaymentsEnabled?: boolean | null },
): boolean {
  return salonTakesClientPayments(tech) && isPaymentsReady(tech);
}

/**
 * True when clients should get "pay your balance" emails/SMS (the 48h balance
 * request and the pay-early button on confirmations). Salons that settle in
 * person turn this off in Settings. Also off when client payments are disabled.
 * Missing balanceEmailsEnabled = on (pre-0043 migration).
 */
export function sendsBalanceEmails(
  tech:
    | ({ balanceEmailsEnabled?: boolean | null; clientPaymentsEnabled?: boolean | null } | null)
    | undefined,
): boolean {
  if (!salonTakesClientPayments(tech)) return false;
  return tech?.balanceEmailsEnabled !== false;
}

export function planLabel(tech: Pick<Tech, "plan" | "subscriptionStatus">): string {
  if (tech.subscriptionStatus === "comped") return "Complimentary";
  if (tech.plan === "annual") return "Annual (£180/yr)";
  if (tech.plan === "monthly") return "Monthly (£19/mo)";
  return "No plan";
}
