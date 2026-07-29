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
import type { SubscriptionStatus, Tech } from "@/lib/db/types";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook-idempotency";
import {
  sendTrialFirstChargeSuccessEmail,
  sendTrialFirstChargeFailedEmail,
  sendPastDueWarningEmail,
  sendBookingPageOfflineWarningEmail,
} from "@/lib/trial-lifecycle";

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

function trialEndIso(sub: Stripe.Subscription): string | null {
  if (typeof sub.trial_end === "number" && sub.trial_end > 0) {
    return new Date(sub.trial_end * 1000).toISOString();
  }
  return null;
}

async function syncSubscriptionToTech(
  sb: ReturnType<typeof supabaseService>,
  s: Stripe,
  tech: Tech,
  sub: Stripe.Subscription,
  statusOverride?: SubscriptionStatus,
) {
  const status = statusOverride ?? mapStatus(sub.status);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const planMeta = sub.metadata?.plan;
  const trialEnds = trialEndIso(sub);
  await updateTech(sb, tech.id, {
    subscriptionStatus: status,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : tech.currentPeriodEnd,
    ...(trialEnds ? { trialEndsAt: trialEnds } : {}),
    ...(planMeta === "monthly" || planMeta === "annual" ? { plan: planMeta } : {}),
  });
  // Referral credit only after a real paid subscription (never during trial).
  if (status === "active") {
    const { maybeGrantReferralCredit } = await import("@/lib/referral-credit");
    await maybeGrantReferralCredit(sb, s, { ...tech, subscriptionStatus: status }, status);
  }
}

/**
 * Stripe webhook. Verifies the signature, then updates tech subscription
 * state and (for Connect charge events) booking payment status.
 *
 * Handlers are idempotent under duplicate delivery via stripe_webhook_events.
 *
 * Required env: STRIPE_WEBHOOK_SECRET
 */
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
  const claimed = await claimStripeWebhookEvent(sb, {
    eventId: event.id,
    type: event.type,
  });
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Connect booking checkouts (deposit / card capture) — confirm + notify once.
        if (
          session.metadata?.bookingId &&
          (session.metadata.kind === "deposit" || session.metadata.kind === "card_capture")
        ) {
          const { completeBookingCheckoutFromSession } = await import("@/lib/bookings");
          await completeBookingCheckoutFromSession(sb, session);
          break;
        }

        // Platform Billing: subscription-mode Checkout (trial + half-price).
        if (session.mode === "subscription" && session.customer) {
          const techId = session.metadata?.techId;
          const tech = techId
            ? ((await sb.from("techs").select("*").eq("id", techId).maybeSingle()).data as Tech | null)
            : await getTechByStripeCustomerId(sb, session.customer as string);
          if (!tech) break;
          const plan = session.metadata?.plan === "annual" ? "annual" : "monthly";
          let status: SubscriptionStatus =
            session.metadata?.offer === "trial" ? "trialing" : "active";
          let trialEndsAt: string | null = tech.trialEndsAt ?? null;
          let subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? tech.stripeSubscriptionId;
          if (typeof session.subscription === "string") {
            try {
              const sub = await s.subscriptions.retrieve(session.subscription);
              status = mapStatus(sub.status);
              const te = trialEndIso(sub);
              if (te) trialEndsAt = te;
              subscriptionId = sub.id;
            } catch {
              // keep inferred status
            }
          }
          await updateTech(sb, tech.id, {
            plan,
            subscriptionStatus: status,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            ...(trialEndsAt ? { trialEndsAt } : {}),
          });
          if (status === "active" && session.metadata?.offer !== "partner") {
            const { maybeGrantReferralCredit } = await import("@/lib/referral-credit");
            await maybeGrantReferralCredit(sb, s, { ...tech, subscriptionStatus: "active" }, "active");
          }
          break;
        }

        // Legacy setup-mode Checkout (card save → create subscription in webhook).
        if (session.mode !== "setup") break;
        const techId = session.metadata?.techId;
        const plan = session.metadata?.plan === "annual" ? "annual" : "monthly";
        const customerId = session.customer as string;
        if (!techId || !customerId) break;

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
        // Trial must never use this path with a coupon (handled via subscription mode).
        const planPrice = plan === "annual" ? PRICES.annual : PRICES.monthly;
        const offerMeta = session.metadata?.offer as OfferId | "trial" | "" | undefined;

        let discounts: ({ promotion_code: string } | { coupon: string })[] | undefined;
        const promo = session.metadata?.promo;
        if (offerMeta !== "trial" && promo) {
          try {
            const codes = await s.promotionCodes.list({ code: promo, active: true, limit: 1 });
            if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
          } catch (err) {
            console.error("[stripe webhook] promo lookup failed:", (err as Error).message);
          }
        }
        if (offerMeta !== "trial" && !discounts && offerMeta) {
          try {
            discounts = [{ coupon: await ensureCoupon(s, offerMeta as OfferId) }];
          } catch (err) {
            console.error("[stripe webhook] offer coupon failed:", (err as Error).message);
          }
        }

        const subscription = await s.subscriptions.create({
          customer: customerId,
          items: [{ price: planPrice }],
          default_payment_method: pm ?? undefined,
          ...(offerMeta === "trial"
            ? {
                trial_period_days: 14,
                trial_settings: {
                  end_behavior: { missing_payment_method: "cancel" as const },
                },
              }
            : { discounts }),
          metadata: { techId, plan, offer: offerMeta || "" },
        });

        const trialEnds = trialEndIso(subscription);
        await updateTech(sb, techId, {
          subscriptionStatus: mapStatus(subscription.status),
          plan,
          stripeSubscriptionId: subscription.id,
          ...(trialEnds ? { trialEndsAt: trialEnds } : {}),
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.metadata?.bookingId &&
          (session.metadata.kind === "deposit" || session.metadata.kind === "card_capture")
        ) {
          const { expireBookingCheckoutFromSession } = await import("@/lib/bookings");
          await expireBookingCheckoutFromSession(sb, session);
        }
        break;
      }

      case "account.updated": {
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
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const tech = await getTechByStripeCustomerId(sb, sub.customer as string);
        if (!tech) break;
        await syncSubscriptionToTech(sb, s, tech, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tech = await getTechByStripeCustomerId(sb, sub.customer as string);
        if (!tech) break;
        await syncSubscriptionToTech(sb, s, tech, sub, "canceled");
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const tech = await getTechByStripeCustomerId(sb, customerId);
        if (!tech) break;
        const billingReason = (invoice as { billing_reason?: string }).billing_reason;
        const isSubscriptionCharge =
          billingReason === "subscription_cycle" ||
          billingReason === "subscription_create" ||
          billingReason === "subscription_update";

        const wasTrialing = tech.subscriptionStatus === "trialing";
        const wasPastDue = tech.subscriptionStatus === "past_due";

        if (isSubscriptionCharge && invoice.amount_paid > 0) {
          await updateTech(sb, tech.id, {
            subscriptionStatus: "active",
            trialPastDueWarnedAt: null,
            bookingPageOfflineWarnedAt: null,
            // Restore booking page if we had taken it offline for dunning.
            ...(tech.bookingPageLive === false ? { bookingPageLive: true } : {}),
          });
          if (tech.signupOffer === "trial" && (wasTrialing || wasPastDue) && !tech.trialFirstChargeEmailSentAt) {
            await sendTrialFirstChargeSuccessEmail(tech);
            await updateTech(sb, tech.id, {
              trialFirstChargeEmailSentAt: new Date().toISOString(),
            });
          }
          if (wasTrialing || wasPastDue || (!tech.referralCreditGrantedAt && tech.referredBy)) {
            const { maybeGrantReferralCredit } = await import("@/lib/referral-credit");
            await maybeGrantReferralCredit(
              sb,
              s,
              { ...tech, subscriptionStatus: "active" },
              "active",
            );
          }
        } else if (wasPastDue) {
          await updateTech(sb, tech.id, {
            subscriptionStatus: "active",
            trialPastDueWarnedAt: null,
            bookingPageOfflineWarnedAt: null,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const tech = await getTechByStripeCustomerId(sb, customerId);
        if (!tech) break;
        const attempt = invoice.attempt_count ?? 1;
        const nextAttempt = invoice.next_payment_attempt;

        await updateTech(sb, tech.id, { subscriptionStatus: "past_due" });
        const refreshed: Tech = { ...tech, subscriptionStatus: "past_due" };

        if (tech.signupOffer === "trial" && (tech.subscriptionStatus === "trialing" || tech.trialEndsAt)) {
          await sendTrialFirstChargeFailedEmail(refreshed);
        }

        // Never take booking page offline without prior email warning.
        // Offline only after retry window exhausted AND a warning was already sent.
        if (!nextAttempt || attempt >= 3) {
          if (!tech.bookingPageOfflineWarnedAt) {
            await sendBookingPageOfflineWarningEmail(refreshed);
            await updateTech(sb, tech.id, {
              bookingPageOfflineWarnedAt: new Date().toISOString(),
            });
          } else {
            await updateTech(sb, tech.id, { bookingPageLive: false });
          }
        } else if (!tech.trialPastDueWarnedAt) {
          await sendPastDueWarningEmail(refreshed);
          await updateTech(sb, tech.id, {
            trialPastDueWarnedAt: new Date().toISOString(),
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", (err as Error).message);
    // Allow Stripe retries after a failed handler (undo claim).
    try {
      await sb.from("stripe_webhook_events").delete().eq("eventId", event.id);
    } catch {
      // ignore
    }
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
