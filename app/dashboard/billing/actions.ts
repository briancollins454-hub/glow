"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDashboardContext } from "@/lib/auth/session";
import { updateTech } from "@/lib/db/queries";
import { stripe, OFFERS } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function ctx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  return c;
}

/** Collect a card (setup mode); the webhook then creates the subscription
 *  with the intro offer (50% off first month, or £1 for invited testers). */
export async function startCheckoutAction(formData: FormData) {
  const { sb, tech } = await ctx();
  const plan = formData.get("plan") === "annual" ? "annual" : "monthly";
  const promo = String(formData.get("promo") ?? "").trim().toUpperCase();

  // Intro offer: testers (unlisted link sets a cookie) get £1 first month;
  // everyone else gets 50% off the first month. Monthly plan only.
  const jar = await cookies();
  const isTester = jar.get("glow_offer")?.value === "tester";
  const offer = plan === "monthly" ? (isTester ? OFFERS.tester1 : OFFERS.firstMonth50) : "";

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
    metadata: { techId: tech.id, plan, promo, offer },
    setup_intent_data: { metadata: { techId: tech.id, plan, promo, offer } },
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
