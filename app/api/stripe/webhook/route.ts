import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { PRICES, ensureCoupon, type OfferId } from "@/lib/stripe";
import { supabaseService } from "@/lib/supabase/service";
import {
  getTechByConnectAccountId,
  getTechByStripeCustomerId,
  updateTech,
} from "@/lib/db/queries";
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

        // Subscription starts immediately at the plan price, with the intro
        // offer (50% off first month, or £1 tester offer) as a one-off coupon
        // on the first invoice. An explicit promo code takes priority.
        const planPrice = plan === "annual" ? PRICES.annual : PRICES.monthly;

        let discounts: ({ promotion_code: string } | { coupon: string })[] | undefined;
        const promo = session.metadata?.promo;
        const offer = session.metadata?.offer as OfferId | "" | undefined;
        if (promo) {
          try {
            const codes = await s.promotionCodes.list({ code: promo, active: true, limit: 1 });
            if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
          } catch (err) {
            console.error("[stripe webhook] promo lookup failed:", (err as Error).message);
          }
        }
        if (!discounts && offer) {
          try {
            discounts = [{ coupon: await ensureCoupon(s, offer) }];
          } catch (err) {
            console.error("[stripe webhook] offer coupon failed:", (err as Error).message);
          }
        }

        const subscription = await s.subscriptions.create({
          customer: customerId,
          items: [{ price: planPrice }],
          default_payment_method: pm ?? undefined,
          discounts,
          metadata: { techId, plan },
        });

        await updateTech(sb, techId, {
          subscriptionStatus: mapStatus(subscription.status),
          plan,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "account.updated": {
        // Stripe Connect: keep the tech's payout capability flags in sync.
        const account = event.data.object as Stripe.Account;
        const tech = await getTechByConnectAccountId(sb, account.id);
        if (tech) {
          await updateTech(sb, tech.id, {
            connectChargesEnabled: !!account.charges_enabled,
            connectPayoutsEnabled: !!account.payouts_enabled,
            connectDetailsSubmitted: !!account.details_submitted,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tech = await getTechByStripeCustomerId(sb, sub.customer as string);
        if (!tech) break;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStatus(sub.status);
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        // Subscription-mode checkout carries the plan in subscription metadata.
        const planMeta = sub.metadata?.plan;
        await updateTech(sb, tech.id, {
          subscriptionStatus: status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : tech.currentPeriodEnd,
          ...(planMeta === "monthly" || planMeta === "annual" ? { plan: planMeta } : {}),
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", (err as Error).message);
    try {
      const { reportError } = await import("@/lib/monitor");
      await reportError(err, { where: "stripe_webhook", type: event.type });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
