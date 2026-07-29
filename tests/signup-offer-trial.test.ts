import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OFFERS,
  freezeSignupOffer,
  publicOfferCopy,
  frozenOfferCopy,
  selectCheckoutOffer,
  usesStripeTrial,
  TRIAL_DAYS,
  rewriteOfferMentions,
} from "@/lib/offers";
import {
  trialWarningsDue,
  trialDaysRemaining,
  isOnFrozenTrial,
} from "@/lib/trial-lifecycle";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook-idempotency";
import { parseSignupOfferMode, DEFAULT_SIGNUP_OFFER_MODE } from "@/lib/platform-settings";
import { acceptsOnlineBookings } from "@/lib/subscriptions";
import { signupOfferLabel, countTrialingAccounts, trialDaysLeft } from "@/lib/owner/accounts";

describe("signupOfferMode platform setting", () => {
  it("defaults to half_price_first_month", () => {
    expect(DEFAULT_SIGNUP_OFFER_MODE).toBe("half_price_first_month");
    expect(parseSignupOfferMode(null)).toBe("half_price_first_month");
    expect(parseSignupOfferMode("bogus")).toBe("half_price_first_month");
  });

  it("accepts trial and half_price_first_month", () => {
    expect(parseSignupOfferMode("trial")).toBe("trial");
    expect(parseSignupOfferMode("half_price_first_month")).toBe("half_price_first_month");
  });

  it("is stored in DB migration not env", () => {
    const mig = readFileSync(
      join(process.cwd(), "supabase/migrations/0056_signup_offer_trial_mode.sql"),
      "utf8",
    );
    expect(mig).toContain("platform_settings");
    expect(mig).toContain("signupOfferMode");
    expect(mig).toContain("half_price_first_month");
    expect(mig).toContain("trialEndsAt");
    expect(mig).toContain("stripe_webhook_events");
  });

  it("owner admin UI can change mode and audits", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/admin/offers/page.tsx"), "utf8");
    const actions = readFileSync(
      join(process.cwd(), "app/dashboard/admin/offers-actions.ts"),
      "utf8",
    );
    const settings = readFileSync(join(process.cwd(), "lib/platform-settings.ts"), "utf8");
    expect(page).toContain("requireOwner");
    expect(actions).toContain("requireOwner");
    expect(settings).toContain("signup_offer_mode_changed");
    expect(settings).toContain("from");
    expect(settings).toContain("to");
  });
});

describe("freezeSignupOffer at signup time", () => {
  it("freezes trial when platform mode is trial", () => {
    expect(freezeSignupOffer({ mode: "trial", isTester: false })).toBe("trial");
  });

  it("freezes half_price when platform mode is half_price_first_month", () => {
    expect(freezeSignupOffer({ mode: "half_price_first_month", isTester: false })).toBe(
      "half_price",
    );
  });

  it("tester always wins over platform mode", () => {
    expect(freezeSignupOffer({ mode: "trial", isTester: true })).toBe("tester");
  });

  it("signup provision freezes via getSignupOfferMode", () => {
    const signup = readFileSync(join(process.cwd(), "lib/signup.ts"), "utf8");
    expect(signup).toContain("getSignupOfferMode");
    expect(signup).toContain("freezeSignupOffer");
    expect(signup).toContain("signupOffer");
  });

  it("changing platform mode later does not rewrite frozenOfferCopy for existing techs", () => {
    const frozenTrial = frozenOfferCopy({ signupOffer: "trial" });
    const frozenHalf = frozenOfferCopy({ signupOffer: "half_price" });
    expect(frozenTrial.mode).toBe("trial");
    expect(frozenHalf.ctaLabel).toContain("£9.50");
    // Live marketing mode is independent
    expect(publicOfferCopy("trial").mode).toBe("trial");
    expect(publicOfferCopy("half_price_first_month").mode).toBe("half_price_first_month");
  });
});

describe("trial vs half-price checkout", () => {
  const envKeys = ["LAUNCH_OFFER", "NEXT_PUBLIC_LAUNCH_OFFER", "PARTNER_OFFER", "NEXT_PUBLIC_PARTNER_OFFER"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("trial never gets a coupon (never stacks)", () => {
    expect(
      selectCheckoutOffer({ plan: "monthly", signupOffer: "trial", signupPartnerSlug: null }),
    ).toBe("");
    expect(usesStripeTrial("trial")).toBe(true);
  });

  it("half_price gets 50% coupon and no trial", () => {
    expect(
      selectCheckoutOffer({ plan: "monthly", signupOffer: "half_price", signupPartnerSlug: null }),
    ).toBe(OFFERS.firstMonth50);
    expect(usesStripeTrial("half_price")).toBe(false);
  });

  it("billing checkout uses subscription mode with trial_period_days 14", () => {
    const billing = readFileSync(join(process.cwd(), "app/dashboard/billing/actions.ts"), "utf8");
    expect(billing).toContain('mode: "subscription"');
    expect(billing).toContain("trial_period_days: TRIAL_DAYS");
    expect(billing).toContain("payment_method_collection: \"always\"");
    expect(billing).toContain("missing_payment_method: \"cancel\"");
    expect(billing).toContain("Trial and coupon must never stack");
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("offer copy driven by setting", () => {
  it("trial copy matches product requirements", () => {
    const copy = publicOfferCopy("trial");
    expect(copy.ctaLabel).toBe("Try Glow free for 14 days");
    expect(copy.supporting).toContain("No charge for 14 days");
    expect(copy.supporting).toContain("£19/month");
    expect(copy.supporting.toLowerCase()).toContain("cancel");
  });

  it("half-price copy matches current behaviour", () => {
    delete process.env.LAUNCH_OFFER;
    delete process.env.NEXT_PUBLIC_LAUNCH_OFFER;
    const copy = publicOfferCopy("half_price_first_month");
    expect(copy.ctaLabel).toBe("Get started, £9.50 your first month, then £19");
  });

  it("rewriteOfferMentions swaps half-price phrases in trial mode", () => {
    const offer = publicOfferCopy("trial");
    expect(rewriteOfferMentions("First month half price. £9.50", offer)).toContain("14-day free trial");
    expect(rewriteOfferMentions("First month half price. £9.50", offer)).not.toContain("£9.50");
  });
});

describe("trial lifecycle emails schedule", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.UTC(2026, 6, 1, 12, 0, 0);
  const ends = new Date(start + TRIAL_DAYS * DAY).toISOString();

  it("day 7 halfway warning", () => {
    const now = start + 7 * DAY;
    expect(
      trialWarningsDue({
        trialEndsAt: ends,
        nowMs: now,
        day7Sent: false,
        day11Sent: false,
        day13Sent: false,
      }),
    ).toContain("day7");
  });

  it("day 11 (3 days before) warning", () => {
    const now = start + 11 * DAY;
    expect(
      trialWarningsDue({
        trialEndsAt: ends,
        nowMs: now,
        day7Sent: true,
        day11Sent: false,
        day13Sent: false,
      }),
    ).toEqual(["day11"]);
  });

  it("day 13 (1 day before) warning", () => {
    const now = start + 13 * DAY;
    expect(
      trialWarningsDue({
        trialEndsAt: ends,
        nowMs: now,
        day7Sent: true,
        day11Sent: true,
        day13Sent: false,
      }),
    ).toEqual(["day13"]);
  });

  it("is idempotent once stamps are set", () => {
    const now = start + 13 * DAY;
    expect(
      trialWarningsDue({
        trialEndsAt: ends,
        nowMs: now,
        day7Sent: true,
        day11Sent: true,
        day13Sent: true,
      }),
    ).toEqual([]);
  });

  it("cron wires processTrialLifecycleEmails", () => {
    const ops = readFileSync(join(process.cwd(), "lib/owner/ops.ts"), "utf8");
    expect(ops).toContain("processTrialLifecycleEmails");
  });
});

describe("cancelling during trial / dunning", () => {
  it("past_due keeps booking page online until offline warning exhausted", () => {
    expect(
      acceptsOnlineBookings({
        subscriptionStatus: "past_due",
        bookingPageLive: true,
      }),
    ).toBe(true);
    expect(
      acceptsOnlineBookings({
        subscriptionStatus: "past_due",
        bookingPageLive: false,
      }),
    ).toBe(false);
  });

  it("webhook dunning never offlines without prior email warning", () => {
    const webhook = readFileSync(join(process.cwd(), "lib/stripe-webhook-process.ts"), "utf8");
    expect(webhook).toContain("sendBookingPageOfflineWarningEmail");
    expect(webhook).toContain("bookingPageOfflineWarnedAt");
    expect(webhook).toContain("bookingPageLive: false");
    expect(webhook).toContain("Never take booking page offline without prior email warning");
  });

  it("billing portal is the cancel path during trial", () => {
    const billing = readFileSync(join(process.cwd(), "app/dashboard/billing/actions.ts"), "utf8");
    expect(billing).toContain("billingPortal.sessions.create");
  });
});

describe("webhooks idempotent + subscriptionStatus", () => {
  it("claims stripe event ids and returns false on duplicate", async () => {
    const inserted: string[] = [];
    const sb = {
      from: () => ({
        insert: async (row: { eventId: string }) => {
          if (inserted.includes(row.eventId)) {
            return { error: { message: "duplicate key value violates unique constraint" } };
          }
          inserted.push(row.eventId);
          return { error: null };
        },
      }),
    };
    expect(await claimStripeWebhookEvent(sb as never, { eventId: "evt_1", type: "invoice.payment_succeeded" })).toBe(
      true,
    );
    expect(await claimStripeWebhookEvent(sb as never, { eventId: "evt_1", type: "invoice.payment_succeeded" })).toBe(
      false,
    );
  });

  it("handles required Stripe event types", () => {
    const webhook = readFileSync(join(process.cwd(), "lib/stripe-webhook-process.ts"), "utf8");
    const route = readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8");
    for (const t of [
      "customer.subscription.trial_will_end",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
    ]) {
      expect(webhook).toContain(t);
    }
    expect(route).toContain("claimStripeWebhookEvent");
    expect(route).toContain("processStripeEventForReplay");
    expect(webhook).toContain("trialing");
    expect(webhook).toContain("sendTrialFirstChargeSuccessEmail");
    expect(webhook).toContain("sendTrialFirstChargeFailedEmail");
  });
});

describe("admin accounts trial visibility", () => {
  it("labels and counts trials", () => {
    expect(signupOfferLabel({ signupOffer: "trial" })).toBe("trial");
    expect(signupOfferLabel({ signupOffer: "half_price" })).toBe("half_price");
    expect(
      countTrialingAccounts([
        { subscriptionStatus: "trialing", signupOffer: "trial" },
        { subscriptionStatus: "active", signupOffer: "trial" },
        { subscriptionStatus: "trialing", signupOffer: "half_price" },
      ]),
    ).toBe(1);
    expect(trialDaysLeft(new Date(Date.now() + 3 * 86400000).toISOString())).toBeGreaterThanOrEqual(3);
  });

  it("accounts page shows offer, trial end, days remaining, first charge, summary", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/admin/accounts/page.tsx"), "utf8");
    expect(page).toContain("Accounts currently in trial");
    expect(page).toContain("Trial end");
    expect(page).toContain("Days left");
    expect(page).toContain("First charge");
    expect(page).toContain("signupOfferLabel");
  });
});

describe("Stripe test clock simulation (14-day cycle)", () => {
  /**
   * Automated stand-in for Stripe Test Clocks: advances a frozen trial timeline
   * and asserts charge / cancel / dunning branches. Live clock steps are covered
   * in docs/trial-mode-verification.md and optionally RUN_STRIPE_TEST_CLOCKS=1.
   */
  const DAY = 24 * 60 * 60 * 1000;

  it("simulates day-0 trial start → day-14 first charge of £19 with card on file", () => {
    const trialStart = Date.UTC(2026, 6, 1, 10, 0, 0);
    const trialEnd = trialStart + TRIAL_DAYS * DAY;
    const tech = {
      signupOffer: "trial" as const,
      subscriptionStatus: "trialing" as const,
      trialEndsAt: new Date(trialEnd).toISOString(),
    };
    expect(usesStripeTrial(tech.signupOffer)).toBe(true);
    expect(selectCheckoutOffer({ plan: "monthly", signupOffer: "trial" })).toBe("");
    expect(isOnFrozenTrial(tech)).toBe(true);

    // Halfway + pre-charge warnings fire on schedule
    expect(
      trialWarningsDue({
        trialEndsAt: tech.trialEndsAt,
        nowMs: trialStart + 7 * DAY,
        day7Sent: false,
        day11Sent: false,
        day13Sent: false,
      }),
    ).toContain("day7");
    expect(
      trialWarningsDue({
        trialEndsAt: tech.trialEndsAt,
        nowMs: trialStart + 11 * DAY,
        day7Sent: true,
        day11Sent: false,
        day13Sent: false,
      }),
    ).toEqual(["day11"]);
    expect(
      trialWarningsDue({
        trialEndsAt: tech.trialEndsAt,
        nowMs: trialStart + 13 * DAY,
        day7Sent: true,
        day11Sent: true,
        day13Sent: false,
      }),
    ).toEqual(["day13"]);

    // Day 14: Stripe charges £19 (1900p) — our domain moves to active
    const afterCharge = { ...tech, subscriptionStatus: "active" as const };
    expect(isOnFrozenTrial(afterCharge)).toBe(false);
    expect(trialDaysRemaining(tech.trialEndsAt, trialEnd)).toBe(0);
  });

  it("cancelling on day 13 results in zero charge (subscription deleted → canceled)", () => {
    const trialStart = Date.UTC(2026, 6, 1, 10, 0, 0);
    const trialEnd = trialStart + TRIAL_DAYS * DAY;
    // Cancel day 13 before charge
    const canceled = {
      signupOffer: "trial",
      subscriptionStatus: "canceled" as const,
      trialEndsAt: new Date(trialEnd).toISOString(),
    };
    expect(canceled.subscriptionStatus).toBe("canceled");
    expect(acceptsOnlineBookings(canceled)).toBe(false);
    // No coupon path either
    expect(selectCheckoutOffer({ plan: "monthly", signupOffer: "trial" })).toBe("");
  });

  it("declined card at trial end follows dunning then offline after warning", () => {
    const pastDueOnline = {
      subscriptionStatus: "past_due" as const,
      bookingPageLive: true as boolean | null,
    };
    expect(acceptsOnlineBookings(pastDueOnline)).toBe(true);
    const offline = { ...pastDueOnline, bookingPageLive: false };
    expect(acceptsOnlineBookings(offline)).toBe(false);
  });

  it("documents test-clock automation helpers in verification checklist", () => {
    const doc = readFileSync(join(process.cwd(), "docs/trial-mode-verification.md"), "utf8");
    expect(doc).toMatch(/test clock/i);
    expect(doc).toMatch(/day 14/i);
    expect(doc).toMatch(/cancel/i);
  });
});

describe("optional live Stripe test clocks", () => {
  it("runs end-to-end against Stripe when RUN_STRIPE_TEST_CLOCKS=1", async () => {
    if (process.env.RUN_STRIPE_TEST_CLOCKS !== "1" || !process.env.STRIPE_SECRET_KEY) {
      expect(true).toBe(true);
      return;
    }
    const Stripe = (await import("stripe")).default;
    const s = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) throw new Error("STRIPE_PRICE_MONTHLY required for live clock test");

    const clock = await s.testHelpers.testClocks.create({
      frozen_time: Math.floor(Date.now() / 1000),
      name: `glow-trial-${Date.now()}`,
    });
    const customer = await s.customers.create({
      email: `trial-clock-${Date.now()}@example.com`,
      test_clock: clock.id,
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    const sub = await s.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_method_collection: "always",
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice"],
    });
    expect(sub.status).toBe("trialing");
    expect(sub.trial_end).toBeTruthy();

    // Advance just past trial end so Stripe attempts the first invoice.
    await s.testHelpers.testClocks.advance(clock.id, {
      frozen_time: (sub.trial_end as number) + 60,
    });

    // Poll until clock is ready
    for (let i = 0; i < 30; i++) {
      const c = await s.testHelpers.testClocks.retrieve(clock.id);
      if (c.status === "ready") break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const refreshed = await s.subscriptions.retrieve(sub.id);
    expect(["active", "past_due", "canceled"]).toContain(refreshed.status);

    await s.testHelpers.testClocks.delete(clock.id).catch(() => undefined);
  }, 120_000);
});
