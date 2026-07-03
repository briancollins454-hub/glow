"use server";

import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { updateTech } from "@/lib/db/queries";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function ctx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  return c;
}

/** Start the £2/14-day trial: collect a card (setup mode), then the webhook
 *  creates the subscription schedule (£2 now -> £19/mo or £180/yr). */
export async function startCheckoutAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const plan = formData.get("plan") === "annual" ? "annual" : "monthly";
  const promo = String(formData.get("promo") ?? "").trim().toUpperCase();
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

  const session = await s.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    customer: customerId,
    success_url: `${APP_URL}/dashboard/billing?status=started`,
    cancel_url: `${APP_URL}/dashboard/billing?status=cancelled`,
    metadata: { techId: tech.id, plan, promo },
    setup_intent_data: { metadata: { techId: tech.id, plan, promo } },
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
