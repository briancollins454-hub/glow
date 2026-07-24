import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  absoluteCanonical,
  bookingPageDescription,
  bookingPageTitle,
  canonicalAppUrl,
  GLOW_AGGREGATE_RATING,
  primaryCategoryLabels,
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

describe("canonical host", () => {
  it("forces https and strips www", () => {
    expect(canonicalAppUrl("http://www.glow-uk.com")).toBe("https://glow-uk.com");
    expect(canonicalAppUrl("https://www.glow-uk.com/")).toBe("https://glow-uk.com");
    expect(canonicalAppUrl("https://glow-uk.com")).toBe("https://glow-uk.com");
  });

  it("builds absolute canonicals on the apex host", () => {
    expect(absoluteCanonical("/vs/fresha")).toMatch(/^https:\/\/[^/]+\/vs\/fresha$/);
    expect(absoluteCanonical("/")).toMatch(/^https?:\/\//);
    expect(absoluteCanonical("/")).not.toContain("www.");
  });

  it("middleware and vercel.json 301 www (and http) to https apex", () => {
    const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    const nextCfg = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
    expect(mw).toContain("www.${apex}");
    expect(mw).toContain('proto === "http"');
    expect(mw).toContain("301");
    expect(vercel).toContain("www.glow-uk.com");
    expect(vercel).toContain("https://glow-uk.com/:path*");
    expect(nextCfg).toContain("www.glow-uk.com");
  });
});

describe("townFromLocation / booking titles", () => {
  it("extracts town from free-text location", () => {
    expect(townFromLocation("Manchester, UK")).toBe("Manchester");
    expect(townFromLocation("Ballymena")).toBe("Ballymena");
    expect(townFromLocation("")).toBeNull();
  });

  it("builds {Business}, {Town} | {Categories} | Book Online titles", () => {
    expect(
      bookingPageTitle({
        businessName: "ILashIt - Lashes by Claudia",
        location: "Ballymena",
        categories: [{ name: "Lash Extensions" }, { name: "Lash Lift" }, { name: "Other" }],
      }),
    ).toBe("ILashIt - Lashes by Claudia, Ballymena | Lash Extensions and Lash Lift | Book Online");

    expect(
      bookingPageTitle({
        businessName: "Frame & Define",
        location: "",
        categories: [{ name: "Brow treatments" }, { name: "Lash Extensions" }],
      }),
    ).toBe("Frame & Define | Lash Extensions and Brow treatments | Book Online");

    expect(
      bookingPageTitle({
        businessName: "Allure Beauty",
        location: null,
        categories: [],
      }),
    ).toBe("Allure Beauty | Book Online");
  });

  it("builds service+location meta descriptions without empty town placeholders", () => {
    const withTown = bookingPageDescription({
      businessName: "Allure Beauty",
      location: "Devizes",
      categories: [{ name: "Nails" }, { name: "Piercings" }, { name: "Lashes" }],
    });
    expect(withTown).toBe(
      "Book lashes, nails, and piercings with Allure Beauty in Devizes. Online booking, instant confirmation.",
    );
    expect(withTown.length).toBeLessThanOrEqual(160);

    const noTown = bookingPageDescription({
      businessName: "Frame & Define",
      location: "",
      categories: [{ name: "Lash Extensions" }],
    });
    expect(noTown).toBe(
      "Book lash extensions with Frame & Define. Online booking, instant confirmation.",
    );
    expect(noTown).not.toContain(" in .");
    expect(noTown).not.toContain("undefined");
  });

  it("ranks primary categories for SERP copy", () => {
    expect(
      primaryCategoryLabels([
        { name: "Other" },
        { name: "Piercings" },
        { name: "Nails" },
        { name: "Imported" },
        { name: "Lash Extensions" },
      ]),
    ).toEqual(["Lash Extensions", "Nails", "Piercings"]);
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

  it("LocalBusiness includes services, prices, address and opening hours", () => {
    const ld = localBusinessJsonLd({
      name: "ILashIt",
      url: "https://glow-uk.com/ilashit",
      location: "Ballymena",
      services: [{ name: "Classic Full Set", pricePennies: 5500 }],
      openingHours: [{ weekday: 2, opens: "09:00", closes: "17:00" }],
    });
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.address).toMatchObject({ addressLocality: "Ballymena", addressCountry: "GB" });
    expect(ld.makesOffer).toEqual([
      expect.objectContaining({
        price: "55.00",
        priceCurrency: "GBP",
        url: "https://glow-uk.com/ilashit",
      }),
    ]);
    expect(ld.openingHoursSpecification).toEqual([
      expect.objectContaining({ dayOfWeek: "Tuesday", opens: "09:00", closes: "17:00" }),
    ]);
  });

  it("LocalBusiness omits address when town is missing", () => {
    const ld = localBusinessJsonLd({
      name: "Frame & Define",
      url: "https://glow-uk.com/frame-define",
      location: "",
      services: [],
    });
    expect(ld.address).toBeUndefined();
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

  it("marketingMetadata sets unique title, description, absolute https canonical, OG, Twitter", () => {
    for (const page of [vsFresha, switchFresha, guideLash]) {
      const meta = marketingMetadata(page);
      expect(meta.title).toBe(page.title);
      expect(meta.description).toBe(page.description);
      expect(String(meta.alternates?.canonical)).toBe(absoluteCanonical(page.path));
      expect(String(meta.alternates?.canonical)).toMatch(/^https:\/\//);
      expect(String(meta.alternates?.canonical)).not.toContain("www.");
      expect(meta.openGraph?.url).toContain(page.path);
      expect(meta.twitter?.card).toBe("summary_large_image");
    }
    expect(vsFresha.title).not.toBe(switchFresha.title);
    expect(vsFresha.description).not.toBe(guideLash.description);
  });
});

describe("sitemap + robots + brand SERP", () => {
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

  it("booking pages use absolute title + canonical + LocalBusiness with hours", () => {
    const page = readFileSync(join(process.cwd(), "app/[handle]/page.tsx"), "utf8");
    expect(page).toContain("bookingPageTitle");
    expect(page).toContain("absoluteCanonical");
    expect(page).toContain("localBusinessJsonLd");
    expect(page).toContain("openingHours");
  });

  it("landing/root titles lead with Glow for brand queries like glowbooking", () => {
    const landing = readFileSync(join(process.cwd(), "components/marketing/landing-page.tsx"), "utf8");
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(landing).toContain("Glow | Booking for lash, brow and nail techs UK");
    expect(layout).toContain("Glow | Booking for lash, brow and nail techs UK");
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
