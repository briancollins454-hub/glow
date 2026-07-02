import type { SubscriptionStatus, Tech } from "@/lib/db/types";

const LIVE_STATUSES: SubscriptionStatus[] = ["trialing", "active", "comped"];

/** True when the tech may accept online bookings (subscribed / trialing / comped). */
export function isLive(tech: Pick<Tech, "subscriptionStatus">): boolean {
  return LIVE_STATUSES.includes(tech.subscriptionStatus);
}

/** True when the tech can accept card payments from clients (Stripe Connect ready). */
export function isPaymentsReady(tech: Pick<Tech, "connectChargesEnabled">): boolean {
  return !!tech.connectChargesEnabled;
}

export function planLabel(tech: Pick<Tech, "plan" | "subscriptionStatus">): string {
  if (tech.subscriptionStatus === "comped") return "Complimentary";
  if (tech.plan === "annual") return "Annual (£180/yr)";
  if (tech.plan === "monthly") return "Monthly (£19/mo)";
  return "No plan";
}
