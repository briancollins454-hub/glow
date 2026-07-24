import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  OFFERS,
  launchOfferCopy,
  launchOfferEnabled,
  partnerOfferEnabled,
  selectCheckoutOffer,
} from "@/lib/offers";
import {
  mergeAttribution,
  parseAttributionFromSearchParams,
  HEAR_ABOUT_OPTIONS,
} from "@/lib/signup-attribution";
import { MARKETING_SITEMAP_PATHS, marketingMetadata } from "@/lib/marketing/types";
import {
  vsFresha,
  vsBooksy,
  vsLushlane,
  vsSalonbooking,
  switchFresha,
  switchBooksy,
  guideLash,
  guideNail,
} from "@/lib/marketing/content";
import { LIST_MONTHLY_PENNIES } from "@/lib/owner/mrr";

describe("launch / partner offer flags", () => {
  const envKeys = [
    "LAUNCH_OFFER",
    "NEXT_PUBLIC_LAUNCH_OFFER",
    "PARTNER_OFFER",
    "NEXT_PUBLIC_PARTNER_OFFER",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults launch and partner offers to on", () => {
    for (const k of envKeys) delete process.env[k];
    expect(launchOfferEnabled()).toBe(true);
    expect(partnerOfferEnabled()).toBe(true);
  });

  it("can turn launch offer off via env", () => {
    process.env.LAUNCH_OFFER = "off";
    delete process.env.NEXT_PUBLIC_LAUNCH_OFFER;
    expect(launchOfferEnabled()).toBe(false);
  });

  it("prefers NEXT_PUBLIC_LAUNCH_OFFER for client parity", () => {
    process.env.LAUNCH_OFFER = "on";
    process.env.NEXT_PUBLIC_LAUNCH_OFFER = "off";
    expect(launchOfferEnabled()).toBe(false);
  });
});

describe("selectCheckoutOffer", () => {
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

  it("applies first-month-50 once for public monthly signups", () => {
    expect(
      selectCheckoutOffer({ plan: "monthly", signupOffer: "", signupPartnerSlug: null }),
    ).toBe(OFFERS.firstMonth50);
  });

  it("does not apply intro coupons to annual plans", () => {
    expect(
      selectCheckoutOffer({ plan: "annual", signupOffer: "", signupPartnerSlug: null }),
    ).toBe("");
  });

  it("prefers tester over partner and launch", () => {
    expect(
      selectCheckoutOffer({
        plan: "monthly",
        signupOffer: "tester",
        signupPartnerSlug: "academy",
      }),
    ).toBe(OFFERS.tester1);
  });

  it("applies partner 3-month coupon for partner signups", () => {
    expect(
      selectCheckoutOffer({
        plan: "monthly",
        signupOffer: "",
        signupPartnerSlug: "lash-academy",
      }),
    ).toBe(OFFERS.partner3Months);
  });

  it("skips partner coupon when PARTNER_OFFER is off", () => {
    process.env.PARTNER_OFFER = "off";
    expect(
      selectCheckoutOffer({
        plan: "monthly",
        signupOffer: "",
        signupPartnerSlug: "lash-academy",
      }),
    ).toBe(OFFERS.firstMonth50);
  });

  it("documents coupon shapes: once vs repeating 3 months", () => {
    const stripe = readFileSync(join(process.cwd(), "lib/stripe.ts"), "utf8");
    expect(stripe).toContain('duration: "once"');
    expect(stripe).toContain("percent_off: 50");
    expect(stripe).toContain("name: \"First month half price\"");
    expect(stripe).toContain('duration: "repeating"');
    expect(stripe).toContain("duration_in_months: 3");
    expect(stripe).toContain("percent_off: 100");
  });
});

describe("launchOfferCopy", () => {
  it("shows £9.50 then £19 when launch offer is on", () => {
    delete process.env.LAUNCH_OFFER;
    delete process.env.NEXT_PUBLIC_LAUNCH_OFFER;
    const copy = launchOfferCopy(false);
    expect(copy.firstMonthLabel).toBe("£9.50");
    expect(copy.thenLabel).toContain("£19");
  });
});

describe("signup attribution helpers", () => {
  it("parses UTM params from the query string", () => {
    const attr = parseAttributionFromSearchParams(
      new URLSearchParams("utm_source=ig&utm_medium=social&utm_campaign=launch&partner=academy"),
    );
    expect(attr.utmSource).toBe("ig");
    expect(attr.utmMedium).toBe("social");
    expect(attr.utmCampaign).toBe("launch");
    expect(attr.partnerSlug).toBe("academy");
  });

  it("keeps first-touch UTMs and allows later partner override", () => {
    const merged = mergeAttribution(
      { utmSource: "ig", utmMedium: "social", utmCampaign: "a", partnerSlug: null },
      { utmSource: "google", partnerSlug: "academy" },
    );
    expect(merged.utmSource).toBe("ig");
    expect(merged.partnerSlug).toBe("academy");
  });

  it("exposes hear-about options required by the brief", () => {
    const values = HEAR_ABOUT_OPTIONS.map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining([
        "instagram",
        "facebook_group",
        "google",
        "referred_by_tech",
        "training_academy",
        "other",
      ]),
    );
  });

  it("persists attribution fields through createTech / provision", () => {
    const signup = readFileSync(join(process.cwd(), "lib/signup.ts"), "utf8");
    const actions = readFileSync(join(process.cwd(), "app/(auth)/actions.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "app/(auth)/signup/page.tsx"), "utf8");
    expect(signup).toContain("signupUtmSource");
    expect(signup).toContain("signupHeardAbout");
    expect(signup).toContain("signupPartnerSlug");
    expect(actions).toContain("heardAbout");
    expect(actions).toContain("partnerSlug");
    expect(page).toContain("How did you hear about us?");
    expect(page).toContain("SignupAttributionFields");
  });
});

describe("referral credit stacking", () => {
  it("credits one free month (£19) to the referrer once the referred tech pays", () => {
    const src = readFileSync(join(process.cwd(), "lib/referral-credit.ts"), "utf8");
    expect(src).toContain("createBalanceTransaction");
    expect(src).toContain("referralCreditGrantedAt");
    expect(LIST_MONTHLY_PENNIES).toBe(1900);
    expect(src).toContain("LIST_MONTHLY_PENNIES");
    expect(src).toMatch(/amount:\s*-LIST_MONTHLY_PENNIES/);
    expect(src).toContain("Roll back the flag");
  });

  it("is triggered from the Stripe subscription webhook", () => {
    const webhook = readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8");
    expect(webhook).toContain("maybeGrantReferralCredit");
  });

  it("keeps launch coupon on invoice 1 separate from referral balance credit", () => {
    const billing = readFileSync(join(process.cwd(), "app/dashboard/billing/actions.ts"), "utf8");
    expect(billing).toMatch(/invoice 1/i);
    expect(billing).toMatch(/invoice 2/i);
    expect(billing).toContain("selectCheckoutOffer");
  });

  it("skips grant when already credited or no referrer", async () => {
    const { maybeGrantReferralCredit } = await import("@/lib/referral-credit");
    const sb = {} as never;
    const s = { customers: { createBalanceTransaction: vi.fn() } } as never;
    await maybeGrantReferralCredit(
      sb,
      s,
      { id: "a", referredBy: null, referralCreditGrantedAt: null } as never,
      "active",
    );
    await maybeGrantReferralCredit(
      sb,
      s,
      {
        id: "b",
        referredBy: "x",
        referralCreditGrantedAt: "2026-01-01T00:00:00.000Z",
      } as never,
      "active",
    );
    expect((s as { customers: { createBalanceTransaction: ReturnType<typeof vi.fn> } }).customers
      .createBalanceTransaction).not.toHaveBeenCalled();
  });
});

describe("marketing routes + meta + sitemap", () => {
  const pages = [
    ["app/vs/fresha/page.tsx", vsFresha],
    ["app/vs/booksy/page.tsx", vsBooksy],
    ["app/vs/lushlane/page.tsx", vsLushlane],
    ["app/vs/salonbooking/page.tsx", vsSalonbooking],
    ["app/switch/fresha/page.tsx", switchFresha],
    ["app/switch/booksy/page.tsx", switchBooksy],
    ["app/guides/best-booking-app-lash-techs-uk/page.tsx", guideLash],
    ["app/guides/best-booking-app-nail-techs-uk/page.tsx", guideNail],
  ] as const;

  for (const [route] of pages) {
    it(`${route} exists with metadata`, () => {
      expect(existsSync(join(process.cwd(), route))).toBe(true);
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).toContain("marketingMetadata");
    });
  }

  it("marketingMetadata sets canonical + OpenGraph", () => {
    const meta = marketingMetadata(vsFresha);
    expect(meta.alternates?.canonical).toBe(vsFresha.path);
    expect(meta.openGraph?.url).toContain(vsFresha.path);
    expect(meta.description).toBe(vsFresha.description);
  });

  it("sitemap lists all marketing paths", () => {
    const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
    expect(sitemap).toContain("MARKETING_SITEMAP_PATHS");
    expect(MARKETING_SITEMAP_PATHS).toEqual(
      expect.arrayContaining([
        "/vs/fresha",
        "/vs/booksy",
        "/vs/lushlane",
        "/vs/salonbooking",
        "/switch/fresha",
        "/switch/booksy",
        "/guides/best-booking-app-lash-techs-uk",
        "/guides/best-booking-app-nail-techs-uk",
      ]),
    );
  });

  it("landing footer links Compare and Switching", () => {
    const landing = readFileSync(join(process.cwd(), "components/marketing/landing-page.tsx"), "utf8");
    expect(landing).toContain("Compare");
    expect(landing).toContain("Switching");
    expect(landing).toContain("Refer a tech, get a month free");
    expect(landing).toContain("COMPARE_LINKS");
    expect(landing).toContain("SWITCH_LINKS");
  });

  it("partner route co-brands signup", () => {
    const partner = readFileSync(join(process.cwd(), "app/partner/[slug]/page.tsx"), "utf8");
    expect(partner).toContain("students get 3 months of Glow free");
    expect(partner).toContain("/signup?partner=");
    expect(partner).not.toMatch(/Claim 3 months free|Start free|Try free/i);
  });
});

describe("marketing CTA copy", () => {
  it("hero CTA does not say free and shows £9.50", () => {
    expect(launchOfferCopy(false).ctaLabel).toBe("Get started, £9.50 your first month");
    expect(launchOfferCopy(false).ctaLabel.toLowerCase()).not.toContain("free");
  });

  it("landing customer/demo buttons use studio labels", () => {
    const landing = readFileSync(join(process.cwd(), "components/marketing/landing-page.tsx"), "utf8");
    expect(landing).toContain('href="/ilashit"');
    expect(landing).toContain('href="/frame-define"');
    expect(landing).toContain('href="/allurebeauty"');
    expect(landing).toContain("Lash studio");
    expect(landing).toContain("Brow bar");
    expect(landing).toContain("Nail studio");
    expect(landing).toContain("Move to Glow free");
    expect(landing).not.toMatch(/>\s*Klaudia\s*</);
    expect(landing).not.toMatch(/>\s*Claire\s*</);
    expect(landing).not.toContain("Start free");
  });
});

describe("ensureCoupon partner branch", () => {
  it("creates partner coupon when missing", async () => {
    const created: unknown[] = [];
    const s = {
      coupons: {
        retrieve: vi.fn().mockRejectedValue(new Error("missing")),
        create: vi.fn().mockImplementation(async (payload: unknown) => {
          created.push(payload);
          return payload;
        }),
      },
    };
    const { ensureCoupon } = await import("@/lib/stripe");
    const id = await ensureCoupon(s as never, OFFERS.partner3Months);
    expect(id).toBe(OFFERS.partner3Months);
    expect(created[0]).toMatchObject({
      id: OFFERS.partner3Months,
      percent_off: 100,
      duration: "repeating",
      duration_in_months: 3,
    });
  });

  it("creates launch coupon when missing", async () => {
    const created: unknown[] = [];
    const s = {
      coupons: {
        retrieve: vi.fn().mockRejectedValue(new Error("missing")),
        create: vi.fn().mockImplementation(async (payload: unknown) => {
          created.push(payload);
          return payload;
        }),
      },
    };
    const { ensureCoupon } = await import("@/lib/stripe");
    await ensureCoupon(s as never, OFFERS.firstMonth50);
    expect(created[0]).toMatchObject({
      id: OFFERS.firstMonth50,
      percent_off: 50,
      duration: "once",
      name: "First month half price",
    });
  });
});
