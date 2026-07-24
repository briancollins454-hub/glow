/** Launch offer and partner coupon helpers for Stripe Billing. */

export const OFFERS = {
  /** Public offer: 50% off the first month. Name shown in Stripe: First month half price. */
  firstMonth50: "first-month-50",
  /** Private tester offer (£1 first month), shared by unlisted link only. */
  tester1: "tester-first-month-1",
  /** Partner academy offer: 100% off for 3 months. */
  partner3Months: "partner-3-months-free",
} as const;

export type OfferId = (typeof OFFERS)[keyof typeof OFFERS];

/** Env-gated public first-month half-price offer. Default on. */
export function launchOfferEnabled(): boolean {
  const raw = (
    process.env.NEXT_PUBLIC_LAUNCH_OFFER ??
    process.env.LAUNCH_OFFER ??
    "on"
  )
    .trim()
    .toLowerCase();
  return raw === "on" || raw === "1" || raw === "true";
}

/** Env-gated partner 3-months-free offer. Default on. */
export function partnerOfferEnabled(): boolean {
  const raw = (
    process.env.NEXT_PUBLIC_PARTNER_OFFER ??
    process.env.PARTNER_OFFER ??
    "on"
  )
    .trim()
    .toLowerCase();
  return raw === "on" || raw === "1" || raw === "true";
}

export function launchOfferCopy(isTester: boolean): {
  firstMonthLabel: string;
  thenLabel: string;
  ctaLabel: string;
  trustLine: string;
} {
  if (isTester) {
    return {
      firstMonthLabel: "£1",
      thenLabel: "then £19/mo",
      ctaLabel: "Go live for £1",
      trustLine: "Tester offer. Then £19/mo. Cancel anytime.",
    };
  }
  if (launchOfferEnabled()) {
    return {
      firstMonthLabel: "£9.50",
      thenLabel: "then £19/mo",
      ctaLabel: "Get started, £9.50 your first month",
      trustLine: "No contracts. No bolt-ons. No per-staff fees. Cancel anytime.",
    };
  }
  return {
    firstMonthLabel: "£19",
    thenLabel: "per month",
    ctaLabel: "Start for £19/mo",
    trustLine: "No contracts. No bolt-ons. No per-staff fees. Cancel anytime.",
  };
}

/**
 * Which intro coupon to attach to a monthly Checkout session.
 * Priority: tester > partner > launch. Annual plans get no intro coupon.
 */
export function selectCheckoutOffer(input: {
  plan: "monthly" | "annual";
  signupOffer: string;
  signupPartnerSlug?: string | null;
}): OfferId | "" {
  if (input.plan !== "monthly") return "";
  if (input.signupOffer === "tester") return OFFERS.tester1;
  if (input.signupPartnerSlug && partnerOfferEnabled()) return OFFERS.partner3Months;
  if (launchOfferEnabled()) return OFFERS.firstMonth50;
  return "";
}
