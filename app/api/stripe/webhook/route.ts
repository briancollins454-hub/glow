import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { PRICES } from "@/lib/stripe";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByStripeCustomerId, updateTech } from "@/lib/db/queries";
import type { SubscriptionStatus } from "@/lib/db/types";

function mapStatus(s: string): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const s = stripe();

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${(err as Error).message}` }, { status: 400 });
  }

  const sb = supabaseService();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "setup") break;
        const techId = session.metadata?.techId;
        const plan = session.metadata?.plan === "annual" ? "annual" : "monthly";
        const customerId = session.customer as string;
        if (!techId || !customerId) break;

        // Get the saved card and set it as the customer default.
        const setupIntentId = session.setup_intent as string;
        const setupIntent = await s.setupIntents.retrieve(setupIntentId);
        const pm = setupIntent.payment_method as string;
        if (pm) {
          await s.customers.update(customerId, {
            invoice_settings: { default_payment_method: pm },
          });
        }

        // £2 for 14 days (phase 1), then the chosen plan price (phase 2).
        const planPrice = plan === "annual" ? PRICES.annual : PRICES.monthly;
        const phases = [
          { items: [{ price: PRICES.trial, quantity: 1 }], iterations: 1 },
          { items: [{ price: planPrice, quantity: 1 }] },
        ] as Stripe.SubscriptionScheduleCreateParams.Phase[];
        const schedule = await s.subscriptionSchedules.create({
          customer: customerId,
          start_date: "now",
          end_behavior: "release",
          phases,
          metadata: { techId, plan },
        });

        await updateTech(sb, techId, {
          subscriptionStatus: "active",
          plan,
          stripeSubscriptionId: (schedule.subscription as string) ?? null,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tech = await getTechByStripeCustomerId(sb, sub.customer as string);
        if (!tech) break;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStatus(sub.status);
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        await updateTech(sb, tech.id, {
          subscriptionStatus: status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : tech.currentPeriodEnd,
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", (err as Error).message);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
