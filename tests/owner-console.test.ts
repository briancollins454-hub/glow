import { describe, expect, it } from "vitest";
import { computeMrrFromTechs, LIST_MONTHLY_PENNIES, LIST_ANNUAL_MRR_PENNIES } from "@/lib/owner/mrr";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("computeMrrFromTechs", () => {
  it("counts only active subscriptions at list price", () => {
    const mrr = computeMrrFromTechs([
      { subscriptionStatus: "active", plan: "monthly", signupOffer: "" },
      { subscriptionStatus: "active", plan: "annual", signupOffer: "" },
      { subscriptionStatus: "trialing", plan: "monthly", signupOffer: "" },
      { subscriptionStatus: "comped", plan: "monthly", signupOffer: "" },
      { subscriptionStatus: "past_due", plan: "monthly", signupOffer: "" },
      { subscriptionStatus: "active", plan: null, signupOffer: "tester" },
    ]);
    expect(mrr.payingMonthly).toBe(1);
    expect(mrr.payingAnnual).toBe(1);
    expect(mrr.mrrPennies).toBe(LIST_MONTHLY_PENNIES + LIST_ANNUAL_MRR_PENNIES);
    expect(mrr.arrPennies).toBe(mrr.mrrPennies * 12);
  });

  it("does not invent MRR for unknown plans", () => {
    const mrr = computeMrrFromTechs([
      { subscriptionStatus: "active", plan: "enterprise", signupOffer: "" },
    ]);
    expect(mrr.mrrPennies).toBe(0);
    expect(mrr.payingCount).toBe(0);
  });
});

describe("traffic tracking fix", () => {
  it("landing and booking pages use PageViewBeacon, not ISR server trackPageView", () => {
    const landing = readFileSync(join(process.cwd(), "components/marketing/landing-page.tsx"), "utf8");
    const booking = readFileSync(join(process.cwd(), "app/[handle]/page.tsx"), "utf8");
    const beacon = readFileSync(
      join(process.cwd(), "components/analytics/page-view-beacon.tsx"),
      "utf8",
    );
    const api = readFileSync(join(process.cwd(), "app/api/t/route.ts"), "utf8");

    expect(landing).toContain("PageViewBeacon");
    expect(landing).not.toContain("trackPageView");
    expect(booking).toContain("PageViewBeacon");
    expect(booking).not.toContain("trackPageView");
    expect(beacon).toContain("/api/t");
    expect(api).toContain("page_views");
    expect(api).toContain("utmSource");
  });

  it("documents that ISR caching was the root cause", () => {
    const pageViews = readFileSync(join(process.cwd(), "lib/page-views.ts"), "utf8");
    expect(pageViews).toMatch(/ISR-cached|cache regeneration/i);
  });
});

describe("owner console routes exist", () => {
  const routes = [
    "app/dashboard/admin/page.tsx",
    "app/dashboard/admin/traffic/page.tsx",
    "app/dashboard/admin/accounts/page.tsx",
    "app/dashboard/admin/accounts/[id]/page.tsx",
    "app/dashboard/admin/revenue/page.tsx",
    "app/dashboard/admin/ops/page.tsx",
    "app/dashboard/admin/support/page.tsx",
  ];
  for (const route of routes) {
    it(route, () => {
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).toContain("requireOwner");
    });
  }
});

describe("owner partners route", () => {
  it("app/dashboard/admin/partners/page.tsx", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/admin/partners/page.tsx"), "utf8");
    expect(src).toContain("requireOwner");
    expect(src).toContain("ownerCreatePartnerAction");
  });
});
