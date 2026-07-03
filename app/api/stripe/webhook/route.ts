import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { PRICES } from "@/lib/stripe";
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

        // The subscription is simply the chosen plan (£19/mo or £180/yr) with a
        // 14-day trial, so the portal shows a clean "£19/month, trial ends X".
        // The £2 is taken as a separate one-time charge now (no proration).
        const planPrice = plan === "annual" ? PRICES.annual : PRICES.monthly;

        // Apply a promo code (e.g. FOUNDER50) if one was entered at checkout.
        let discounts: { promotion_code: string }[] | undefined;
        const promo = session.metadata?.promo;
        if (promo) {
          try {
            const codes = await s.promotionCodes.list({ code: promo, active: true, limit: 1 });
            if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
          } catch (err) {
            console.error("[stripe webhook] promo lookup failed:", (err as Error).message);
          }
        }

        const subscription = await s.subscriptions.create({
          customer: customerId,
          items: [{ price: planPrice }],
          trial_period_days: 14,
          default_payment_method: pm ?? undefined,
          discounts,
          metadata: { techId, plan },
        });

        // £2 trial fee, charged immediately as a one-off.
        if (pm) {
          try {
            await s.paymentIntents.create({
              amount: 200,
              currency: "gbp",
              customer: customerId,
              payment_method: pm,
              off_session: true,
              confirm: true,
              description: "Glow - £2 for your first 14 days",
              metadata: { techId, kind: "trial_fee" },
            });
          } catch (err) {
            console.error("[stripe webhook] trial fee charge failed:", (err as Error).message);
          }
        }

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
