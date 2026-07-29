import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  computeHealthFromSignals,
  bandForScore,
  topHealthReasons,
} from "@/lib/owner/health";
import {
  matchesStalledSignup,
  matchesSetupNotLive,
  matchesLiveNoBookings,
} from "@/lib/owner/worklists";
import {
  addMonths,
  buildRetentionGrid,
  computeMrrMovement,
} from "@/lib/owner/cohorts";
import { computeAccountMargin } from "@/lib/owner/economics";
import { reconcileAttributionSignups } from "@/lib/owner/attribution";
import { detectReferralFraud } from "@/lib/owner/referrals";
import {
  aggregateFeedbackThemes,
  normaliseThemeKey,
  mapFeedbackStatus,
} from "@/lib/owner/feedback-board";
import type { Tech } from "@/lib/db/types";

function tech(partial: Partial<Tech> & Pick<Tech, "id" | "handle" | "email">): Tech {
  return {
    authUserId: null,
    name: "",
    businessName: partial.businessName || partial.handle,
    phone: "",
    timezone: "Europe/London",
    brandColor: "#C4785A",
    tagline: "",
    coverPhotoPath: null,
    profilePhotoPath: null,
    plan: "monthly",
    subscriptionStatus: "none",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeConnectAccountId: null,
    connectChargesEnabled: false,
    connectPayoutsEnabled: false,
    connectDetailsSubmitted: false,
    loyaltyVisitThreshold: 0,
    googleRefreshToken: null,
    googleConnectedAt: null,
    smsRemindersEnabled: false,
    referredBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as Tech;
}

describe("Phase 2 health score", () => {
  it("is deterministic and exposes top reasons", () => {
    const healthy = computeHealthFromSignals({
      lastOwnerLoginAt: new Date().toISOString(),
      bookings14d: 10,
      bookingsPrev14d: 10,
      bookingPageLive: true,
      serviceCount: 3,
      staffCount: 1,
      hasRota: false,
      hasOpeningHours: true,
      stripeConnected: true,
      hasBranding: true,
      featureAdoptionCount: 6,
      featureAdoptionTotal: 12,
      emailDeliveryIssue: false,
      subscriptionStatus: "active",
      atRiskManual: false,
      clientsNow: 20,
      clientsPrevApprox: 20,
    });
    expect(healthy.score).toBeGreaterThanOrEqual(70);
    expect(healthy.band).toBe("healthy");

    const risk = computeHealthFromSignals({
      lastOwnerLoginAt: null,
      bookings14d: 0,
      bookingsPrev14d: 20,
      bookingPageLive: true,
      serviceCount: 0,
      staffCount: 0,
      hasRota: false,
      hasOpeningHours: false,
      stripeConnected: false,
      hasBranding: false,
      featureAdoptionCount: 0,
      featureAdoptionTotal: 12,
      emailDeliveryIssue: true,
      subscriptionStatus: "past_due",
      atRiskManual: true,
      clientsNow: 2,
      clientsPrevApprox: 10,
    });
    expect(risk.band).toBe("at_risk");
    expect(risk.score).toBeLessThan(40);
    const top = topHealthReasons(risk, 2);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0]!.impact).toBeLessThan(0);
    expect(bandForScore(75)).toBe("healthy");
    expect(bandForScore(50)).toBe("watch");
    expect(bandForScore(10)).toBe("at_risk");
  });
});

describe("Phase 2 worklist predicates", () => {
  it("matches definitions and would exclude canceled stalled", () => {
    expect(matchesStalledSignup({ serviceCount: 0, subscriptionStatus: "none" })).toBe(true);
    expect(matchesStalledSignup({ serviceCount: 0, subscriptionStatus: "canceled" })).toBe(false);
    expect(
      matchesSetupNotLive({ serviceCount: 2, bookingPageLive: false, live: true }),
    ).toBe(true);
    expect(
      matchesLiveNoBookings({ accepting: true, serviceCount: 1, bookings14d: 0 }),
    ).toBe(true);
    expect(
      matchesLiveNoBookings({ accepting: true, serviceCount: 1, bookings14d: 3 }),
    ).toBe(false);
  });

  it("worklists page is owner-gated", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/admin/worklists/page.tsx"), "utf8");
    expect(page).toContain("requireOwner");
    expect(page).toContain("buildWorklists");
  });
});

describe("Phase 2 retention / MRR movement", () => {
  it("handles month and year boundaries", () => {
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-01", 0)).toBe("2026-01");

    const techs = [
      { id: "a", createdAt: "2026-01-10T00:00:00.000Z" },
      { id: "b", createdAt: "2026-01-15T00:00:00.000Z" },
      { id: "c", createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    const snaps = [
      { techId: "a", snapshotDate: "2026-01-31", subscriptionStatus: "active", mrrPennies: 1900, healthScore: 80 },
      { techId: "b", snapshotDate: "2026-01-31", subscriptionStatus: "active", mrrPennies: 1900, healthScore: 70 },
      { techId: "a", snapshotDate: "2026-02-28", subscriptionStatus: "active", mrrPennies: 1900, healthScore: 80 },
      { techId: "b", snapshotDate: "2026-02-28", subscriptionStatus: "canceled", mrrPennies: 0, healthScore: 20 },
      { techId: "c", snapshotDate: "2026-02-28", subscriptionStatus: "active", mrrPennies: 1900, healthScore: 75 },
    ];
    const grid = buildRetentionGrid(techs, snaps, { asOfMonth: "2026-02" });
    expect(grid.cells["2026-01"]?.[0]?.accounts).toBe(2);
    expect(grid.cells["2026-01"]?.[1]?.accounts).toBe(1);

    const movement = computeMrrMovement(snaps);
    expect(movement.length).toBe(1);
    expect(movement[0]!.month).toBe("2026-02");
    expect(movement[0]!.newPennies).toBe(1900);
    expect(movement[0]!.churnedPennies).toBe(1900);
  });
});

describe("Phase 2 economics", () => {
  it("verifies margin arithmetic and flag threshold", () => {
    const ok = computeAccountMargin({
      revenuePennies: 1900,
      allocableSharePennies: 100,
      attributablePennies: 200,
      warnPercent: 40,
    });
    expect(ok.totalCostPennies).toBe(300);
    expect(ok.marginPennies).toBe(1600);
    expect(ok.flagged).toBe(false);

    const flagged = computeAccountMargin({
      revenuePennies: 1900,
      allocableSharePennies: 100,
      attributablePennies: 1000,
      warnPercent: 40,
    });
    expect(flagged.flagged).toBe(true);
  });
});

describe("Phase 2 attribution", () => {
  it("reconciles bucket totals with raw signups", () => {
    expect(reconcileAttributionSignups([{ signups: 3 }, { signups: 2 }], 5)).toBe(true);
    expect(reconcileAttributionSignups([{ signups: 3 }], 5)).toBe(false);
  });
});

describe("Phase 2 referral fraud", () => {
  it("flags seeded collusion cases", () => {
    const a = tech({
      id: "t1",
      handle: "alice",
      email: "alice@example.com",
      signupIp: "1.2.3.4",
      signupUserAgent: "GlowTest/1",
      signupCardFingerprint: "fp_1",
    });
    const b = tech({
      id: "t2",
      handle: "bob",
      email: "bob@example.com",
      referredBy: "alice",
      signupIp: "1.2.3.4",
      signupUserAgent: "GlowTest/1",
      signupCardFingerprint: "fp_1",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const self = tech({
      id: "t3",
      handle: "selfy",
      email: "self@example.com",
      referredBy: "selfy",
    });
    const flags = detectReferralFraud([a, b, self]);
    expect(flags.some((f) => f.rule === "self_referral")).toBe(true);
    expect(flags.some((f) => f.rule === "same_signup_ip")).toBe(true);
    expect(flags.some((f) => f.rule === "same_card_fingerprint")).toBe(true);
  });
});

describe("Phase 2 feedback board", () => {
  it("counts requesters correctly", () => {
    expect(mapFeedbackStatus("new")).toBe("open");
    expect(mapFeedbackStatus("done")).toBe("shipped");
    const key = normaliseThemeKey("SMS", "Please add SMS reminders");
    const themes = aggregateFeedbackThemes(
      [
        {
          id: "1",
          techId: "a",
          topic: "SMS",
          message: "Please add SMS reminders",
          status: "new",
          themeKey: key,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          techId: "b",
          topic: "SMS",
          message: "Please add SMS reminders",
          status: "reviewing",
          themeKey: key,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "3",
          techId: "a",
          topic: "SMS",
          message: "Please add SMS reminders",
          status: "new",
          themeKey: key,
          createdAt: "2026-01-03T00:00:00.000Z",
        },
      ],
      new Map([
        ["a", { id: "a", businessName: "A", handle: "a", isInternal: false }],
        ["b", { id: "b", businessName: "B", handle: "b", isInternal: false }],
      ]),
    );
    expect(themes).toHaveLength(1);
    expect(themes[0]!.requesterCount).toBe(2);
    expect(themes[0]!.status).toBe("planned");
  });
});

describe("Phase 2 owner daily action", () => {
  it("manual action requires confirm and always redirects", () => {
    const actions = readFileSync(
      join(process.cwd(), "app/dashboard/admin/phase2-actions.ts"),
      "utf8",
    );
    expect(actions).toContain("runOwnerDailyAction");
    expect(actions).toContain('err=confirm');
    expect(actions).toContain("isNextRedirect");
    expect(actions).toContain("owner_daily_manual");
    const health = readFileSync(join(process.cwd(), "lib/owner/health.ts"), "utf8");
    expect(health).toContain("Batched reads");
    expect(health).not.toContain("probeFeatureFlags(tech)");
  });
});

describe("Phase 2 schema and routes", () => {
  it("migration 0059 and routes exist", () => {
    const mig = readFileSync(
      join(process.cwd(), "supabase/migrations/0059_owner_console_phase2.sql"),
      "utf8",
    );
    expect(mig).toContain("partner_ledger_entries");
    expect(mig).toContain("themeKey");
    expect(mig).toContain("signupIp");

    for (const p of [
      "app/dashboard/admin/worklists/page.tsx",
      "app/dashboard/admin/adoption/page.tsx",
      "app/dashboard/admin/economics/page.tsx",
      "app/dashboard/admin/attribution/page.tsx",
      "app/dashboard/admin/referrals/page.tsx",
      "app/dashboard/admin/feedback/page.tsx",
      "app/api/cron/owner-daily/route.ts",
      "lib/owner/daily-job.ts",
    ]) {
      expect(existsSync(join(process.cwd(), p))).toBe(true);
    }

    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain("/api/cron/owner-daily");

    const support = readFileSync(join(process.cwd(), "app/dashboard/admin/actions.ts"), "utf8");
    expect(support).toContain("writeOwnerAudit");
    expect(support).toContain("attributedToOwnerEmail");
  });
});
