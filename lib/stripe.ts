import Stripe from "stripe";

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
  trial: process.env.STRIPE_PRICE_TRIAL ?? "", // £2 every 14 days (phase 1, 1 iteration)
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? "", // £19/month
  annual: process.env.STRIPE_PRICE_ANNUAL ?? "", // £180/year
};

export function activeStatuses(): string[] {
  return ["trialing", "active", "comped"];
}
