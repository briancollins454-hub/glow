import Stripe from "stripe";
import { OFFERS, type OfferId } from "@/lib/offers";

export { OFFERS, type OfferId } from "@/lib/offers";
export {
  launchOfferEnabled,
  partnerOfferEnabled,
  launchOfferCopy,
  selectCheckoutOffer,
} from "@/lib/offers";

// Platform Stripe client for BILLING (techs subscribing to Glow). This is
// separate from Stripe Connect (client deposits paid to techs).
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cached;
}

// Price IDs are created via the API (scripts/stripe-setup.mjs) and stored in env.
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? "", // £19/month
  annual: process.env.STRIPE_PRICE_ANNUAL ?? "", // £180/year
};

/** Find-or-create one of our intro coupons; returns the coupon id. */
export async function ensureCoupon(s: Stripe, id: OfferId): Promise<string> {
  try {
    await s.coupons.retrieve(id);
    return id;
  } catch {
    if (id === OFFERS.firstMonth50) {
      await s.coupons.create({
        id,
        percent_off: 50,
        duration: "once",
        name: "First month half price",
      });
    } else if (id === OFFERS.partner3Months) {
      await s.coupons.create({
        id,
        percent_off: 100,
        duration: "repeating",
        duration_in_months: 3,
        name: "Partner: 3 months free",
      });
    } else {
      await s.coupons.create({
        id,
        amount_off: 1800,
        currency: "gbp",
        duration: "once",
        name: "Tester offer: first month £1",
      });
    }
    return id;
  }
}

export function activeStatuses(): string[] {
  return ["trialing", "active", "comped"];
}
