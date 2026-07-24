import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  bookingPageDescription,
  bookingPageTitle,
  GLOW_AGGREGATE_RATING,
  PRICING_FAQS,
  SOFTWARE_APPLICATION,
  townFromLocation,
} from "@/lib/seo/config";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/seo/json-ld";
import { MARKETING_SITEMAP_PATHS, marketingMetadata } from "@/lib/marketing/types";
import { vsFresha, switchFresha, guideLash } from "@/lib/marketing/content";

describe("townFromLocation / booking titles", () => {
  it("extracts town from free-text location", () => {
    expect(townFromLocation("Manchester, UK")).toBe("Manchester");
    expect(townFromLocation("Ballymena")).toBe("Ballymena");
    expect(townFromLocation("")).toBeNull();
  });

  it("builds Book with {name} | {town} titles", () => {
    expect(bookingPageTitle("ILashIt", "Ballymena, NI")).toBe("Book with ILashIt | Ballymena");
    expect(bookingPageTitle("Allure Beauty", "")).toBe("Book with Allure Beauty");
  });

  it("builds meta descriptions under 160 chars", () => {
    const d = bookingPageDescription({
      businessName: "Allure Beauty",
      location: "Devizes",
      cardCapture: false,
    });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toContain("Allure Beauty");
  });
});

describe("JSON-LD builders", () => {
  it("SoftwareApplication includes £19 GBP offer and aggregateRating from config", () => {
    const ld = softwareApplicationJsonLd();
    expect(ld["@type"]).toBe("SoftwareApplication");
    expect(ld.offers).toMatchObject({
      price: SOFTWARE_APPLICATION.offers.price,
      priceCurrency: "GBP",
    });
    expect(ld.aggregateRating).toMatchObject({
      ratingValue: GLOW_AGGREGATE_RATING.ratingValue,
      reviewCount: GLOW_AGGREGATE_RATING.reviewCount,
    });
  });

  it("Organization schema is sitewide-ready", () => {
    expect(organizationJsonLd()["@type"]).toBe("Organization");
    expect(organizationJsonLd().name).toBe("Glow");
  });

  it("FAQPage schema covers pricing FAQs", () => {
    const ld = faqPageJsonLd(PRICING_FAQS);
    expect(ld["@type"]).toBe("FAQPage");
    expect((ld.mainEntity as unknown[]).length).toBe(PRICING_FAQS.length);
  });

  it("BreadcrumbList for compare/switch", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/vs/fresha" },
      { name: "Glow vs Fresha", path: "/vs/fresha" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect((ld.itemListElement as { position: number }[]).map((i) => i.position)).toEqual([
      1, 2, 3,
    ]);
  });

  it("LocalBusiness includes services and location when present", () => {
    const ld = localBusinessJsonLd({
      name: "ILashIt",
      url: "https://glow-uk.com/ilashit",
      location: "Ballymena",
      services: [{ name: "Classic Full Set", pricePennies: 5500 }],
    });
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.address).toBeTruthy();
    expect(ld.makesOffer).toHaveLength(1);
  });
});

describe("marketing metadata on every route", () => {
  const routes = [
    "app/vs/fresha/page.tsx",
    "app/vs/booksy/page.tsx",
    "app/vs/lushlane/page.tsx",
    "app/vs/salonbooking/page.tsx",
    "app/switch/fresha/page.tsx",
    "app/switch/booksy/page.tsx",
    "app/guides/best-booking-app-lash-techs-uk/page.tsx",
    "app/guides/best-booking-app-nail-techs-uk/page.tsx",
    "app/pricing/page.tsx",
  ];

  for (const route of routes) {
    it(`${route} exports marketing metadata`, () => {
      expect(existsSync(join(process.cwd(), route))).toBe(true);
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).toMatch(/marketingMetadata|export const metadata/);
    });
  }

  it("marketingMetadata sets unique title, description, canonical, OG, Twitter", () => {
    for (const page of [vsFresha, switchFresha, guideLash]) {
      const meta = marketingMetadata(page);
      expect(meta.title).toBe(page.title);
      expect(meta.description).toBe(page.description);
      expect(meta.alternates?.canonical).toBe(page.path);
      expect(meta.openGraph?.url).toContain(page.path);
      expect(meta.twitter?.card).toBe("summary_large_image");
    }
    expect(vsFresha.title).not.toBe(switchFresha.title);
    expect(vsFresha.description).not.toBe(guideLash.description);
  });
});

describe("sitemap + robots", () => {
  it("sitemap includes pricing and marketing paths", () => {
    const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
    expect(sitemap).toContain("MARKETING_SITEMAP_PATHS");
    expect(MARKETING_SITEMAP_PATHS).toContain("/pricing");
    expect(MARKETING_SITEMAP_PATHS).toContain("/vs/fresha");
  });

  it("robots allows marketing, disallows dashboard/api and booking query variants", () => {
    const robots = readFileSync(join(process.cwd(), "app/robots.ts"), "utf8");
    expect(robots).toContain('allow: "/"');
    expect(robots).toContain("/dashboard");
    expect(robots).toContain("/api/");
    expect(robots).toContain("/*?*service=");
  });

  it("booking pages use absolute title + canonical + LocalBusiness", () => {
    const page = readFileSync(join(process.cwd(), "app/[handle]/page.tsx"), "utf8");
    expect(page).toContain("bookingPageTitle");
    expect(page).toContain("alternates: { canonical");
    expect(page).toContain("localBusinessJsonLd");
  });

  it("landing ships SoftwareApplication JSON-LD", () => {
    const landing = readFileSync(join(process.cwd(), "components/marketing/landing-page.tsx"), "utf8");
    expect(landing).toContain("softwareApplicationJsonLd");
  });

  it("layout ships Organization JSON-LD, GSC verification hook, analytics", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("organizationJsonLd");
    expect(layout).toContain("GOOGLE_SITE_VERIFICATION");
    expect(layout).toContain("SiteAnalytics");
  });

  it("comparison tables reserve space to limit CLS", () => {
    const article = readFileSync(
      join(process.cwd(), "components/marketing/marketing-article.tsx"),
      "utf8",
    );
    expect(article).toContain("table-fixed");
    expect(article).toContain("min-h-[12rem]");
    expect(article).toContain("breadcrumbJsonLd");
  });

  it("pricing page renders FAQPage schema", () => {
    const pricing = readFileSync(join(process.cwd(), "app/pricing/page.tsx"), "utf8");
    expect(pricing).toContain("faqPageJsonLd");
    expect(pricing).toContain("PRICING_FAQS");
  });
});
