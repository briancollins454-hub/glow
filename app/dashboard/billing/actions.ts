"use server";

import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { updateTech } from "@/lib/db/queries";
import {
  stripe,
  OFFERS,
  PRICES,
  ensureCoupon,
  selectCheckoutOffer,
} from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function ctx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (c!.role !== "owner") redirect("/dashboard");
  return c;
}

/**
 * Subscription checkout. Intro offers are applied to the Checkout session so
 * Stripe shows the real amount due today.
 *
 * Stacking: launch/partner coupon on invoice 1; referral balance credits are
 * applied later (from invoice 2 onward) when a referred tech becomes paying.
 */
export async function startCheckoutAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const plan = formData.get("plan") === "annual" ? "annual" : "monthly";
  const promo = String(formData.get("promo") ?? "").trim().toUpperCase();

  const offer = selectCheckoutOffer({
    plan,
    signupOffer: tech.signupOffer,
    signupPartnerSlug: tech.signupPartnerSlug,
  });

  const s = stripe();

  let customerId = tech.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({
      email: tech.email,
      name: tech.businessName,
      metadata: { techId: tech.id },
    });
    customerId = customer.id;
    await updateTech(sb, tech.id, { stripeCustomerId: customerId });
  }

  let discounts: ({ promotion_code: string } | { coupon: string })[] | undefined;
  if (promo) {
    try {
      const codes = await s.promotionCodes.list({ code: promo, active: true, limit: 1 });
      if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
    } catch (err) {
      console.error("[billing] promo lookup failed:", (err as Error).message);
    }
  }
  if (!discounts && offer) {
    try {
      discounts = [{ coupon: await ensureCoupon(s, offer as (typeof OFFERS)[keyof typeof OFFERS]) }];
    } catch (err) {
      console.error("[billing] offer coupon failed:", (err as Error).message);
    }
  }

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [{ price: plan === "annual" ? PRICES.annual : PRICES.monthly, quantity: 1 }],
    discounts,
    subscription_data: {
      metadata: {
        techId: tech.id,
        plan,
        offer: offer || "",
        partnerSlug: tech.signupPartnerSlug ?? "",
      },
    },
    metadata: { techId: tech.id, plan, offer: offer || "" },
    success_url: `${APP_URL}/dashboard/billing?status=started`,
    cancel_url: `${APP_URL}/dashboard/billing?status=cancelled`,
  });

  redirect(session.url!);
}

export async function manageBillingAction() {
  const { tech } = await ctx();
  if (!tech.stripeCustomerId) redirect("/dashboard/billing");
  const s = stripe();
  const portal = await s.billingPortal.sessions.create({
    customer: tech.stripeCustomerId,
    return_url: `${APP_URL}/dashboard/billing`,
  });
  redirect(portal.url);
}
