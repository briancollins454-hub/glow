/** Launch offer, trial, and partner coupon helpers for Stripe Billing. */

import type { SignupOfferMode } from "@/lib/platform-settings";

export const OFFERS = {
  /** Public offer: 50% off the first month. Name shown in Stripe: First month half price. */
  firstMonth50: "first-month-50",
  /** Private tester offer (£1 first month), shared by unlisted link only. */
  tester1: "tester-first-month-1",
  /** Partner academy offer: 100% off for 3 months. */
  partner3Months: "partner-3-months-free",
} as const;

export type OfferId = (typeof OFFERS)[keyof typeof OFFERS];

/** Frozen per-tech signup offer captured at account creation. */
export type FrozenSignupOffer = "trial" | "half_price" | "tester" | "";

export const TRIAL_DAYS = 14;
export const MONTHLY_PRICE_LABEL = "£19";
export const MONTHLY_PRICE_PENNIES = 1900;

/** Env-gated public first-month half-price offer. Default on. Used only when mode is half_price. */
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

/**
 * Map the live platform mode (+ tester flag) into the value frozen on the tech
 * at signup. Partner slug is separate (signupPartnerSlug).
 */
export function freezeSignupOffer(opts: {
  mode: SignupOfferMode;
  isTester: boolean;
}): FrozenSignupOffer {
  if (opts.isTester) return "tester";
  if (opts.mode === "trial") return "trial";
  return "half_price";
}

export type PublicOfferCopy = {
  mode: SignupOfferMode | "tester";
  firstMonthLabel: string;
  thenLabel: string;
  ctaLabel: string;
  trustLine: string;
  headline: string;
  supporting: string;
};

/** Customer-facing pricing copy driven by the live platform mode (marketing). */
export function publicOfferCopy(
  mode: SignupOfferMode,
  opts?: { isTester?: boolean },
): PublicOfferCopy {
  if (opts?.isTester) {
    return {
      mode: "tester",
      firstMonthLabel: "£1",
      thenLabel: "then £19/mo",
      ctaLabel: "Go live for £1",
      trustLine: "Tester offer. Then £19/mo. Cancel anytime.",
      headline: "Go live for £1",
      supporting: "Tester offer — £1 your first month, then £19/mo. Cancel any time.",
    };
  }
  if (mode === "trial") {
    return {
      mode: "trial",
      firstMonthLabel: "Free",
      thenLabel: "then £19/mo",
      ctaLabel: "Try Glow free for 14 days",
      trustLine:
        "No charge for 14 days. We'll take your card details now and your subscription starts at £19/month when the trial ends. Cancel any time before then and you won't be charged.",
      headline: "Try Glow free for 14 days",
      supporting:
        "No charge for 14 days. We'll take your card details now and your subscription starts at £19/month when the trial ends. Cancel any time before then and you won't be charged.",
    };
  }
  // half_price_first_month (and launchOfferEnabled off → full price)
  if (launchOfferEnabled()) {
    return {
      mode: "half_price_first_month",
      firstMonthLabel: "£9.50",
      thenLabel: "then £19/mo",
      ctaLabel: "Get started, £9.50 your first month, then £19",
      trustLine: "No contracts. No bolt-ons. No per-staff fees. Cancel anytime.",
      headline: "Get started, £9.50 your first month, then £19",
      supporting: "First month half price. Then £19/mo. Cancel any time.",
    };
  }
  return {
    mode: "half_price_first_month",
    firstMonthLabel: "£19",
    thenLabel: "per month",
    ctaLabel: "Start for £19/mo",
    trustLine: "No contracts. No bolt-ons. No per-staff fees. Cancel anytime.",
    headline: "Start for £19/mo",
    supporting: "Everything included. Cancel any time.",
  };
}

/**
 * Copy for a tech based on their *frozen* signupOffer (never the live platform
 * mode). Used on billing / paywall / welcome emails.
 */
export function frozenOfferCopy(opts: {
  signupOffer: string;
  signupPartnerSlug?: string | null;
}): PublicOfferCopy {
  if (opts.signupOffer === "tester") {
    return publicOfferCopy("half_price_first_month", { isTester: true });
  }
  if (opts.signupPartnerSlug && partnerOfferEnabled()) {
    return {
      mode: "half_price_first_month",
      firstMonthLabel: "£0",
      thenLabel: "then £19/mo after 3 months",
      ctaLabel: "Start free for 3 months",
      trustLine: "Partner offer — 3 months free, then £19/mo. Cancel anytime.",
      headline: "3 months free",
      supporting: "Partner academy offer. Then £19/mo. Cancel any time.",
    };
  }
  if (opts.signupOffer === "trial") {
    return publicOfferCopy("trial");
  }
  // half_price, "" (legacy), or anything else → half-price style when launch on
  return publicOfferCopy("half_price_first_month");
}

/** @deprecated Prefer publicOfferCopy(mode) or frozenOfferCopy. Kept for tests. */
export function launchOfferCopy(isTester: boolean): {
  firstMonthLabel: string;
  thenLabel: string;
  ctaLabel: string;
  trustLine: string;
} {
  const copy = publicOfferCopy("half_price_first_month", { isTester });
  return {
    firstMonthLabel: copy.firstMonthLabel,
    thenLabel: copy.thenLabel,
    ctaLabel: isTester ? copy.ctaLabel : "Get started, £9.50 your first month",
    trustLine: copy.trustLine,
  };
}

/**
 * Which intro coupon to attach to a monthly Checkout session.
 * Priority: tester > partner > half_price launch coupon.
 * Trial never gets a coupon (trial and coupon must never stack).
 * Annual plans get no intro coupon.
 */
export function selectCheckoutOffer(input: {
  plan: "monthly" | "annual";
  signupOffer: string;
  signupPartnerSlug?: string | null;
}): OfferId | "" {
  if (input.plan !== "monthly") return "";
  if (input.signupOffer === "tester") return OFFERS.tester1;
  if (input.signupPartnerSlug && partnerOfferEnabled()) return OFFERS.partner3Months;
  // Trial and coupon never stack.
  if (input.signupOffer === "trial") return "";
  // half_price or legacy "" with launch offer on
  if (input.signupOffer === "half_price" || input.signupOffer === "") {
    if (launchOfferEnabled()) return OFFERS.firstMonth50;
  }
  return "";
}

/** Rewrite hardcoded half-price phrases when the live mode is trial (and vice versa). */
export function rewriteOfferMentions(text: string, offer: PublicOfferCopy): string {
  if (offer.mode === "trial") {
    return text
      .replace(/Start for half price/gi, offer.ctaLabel)
      .replace(/First month half price\.?/g, "14-day free trial")
      .replace(/first month half price\.?/g, "14-day free trial")
      .replace(/£9\.50 your first month, then £19/g, "Try free for 14 days, then £19")
      .replace(/£9\.50, then £19/g, "free for 14 days, then £19")
      .replace(/£9\.50 first month, then £19\/mo/g, "14-day free trial, then £19/mo")
      .replace(/£9\.50/g, "free for 14 days");
  }
  return text;
}

/** True when Checkout should use a 14-day Stripe trial (card captured, no charge yet). */
export function usesStripeTrial(signupOffer: string): boolean {
  return signupOffer === "trial";
}
