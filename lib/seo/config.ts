/** Shared SEO constants for metadata and JSON-LD. */

/**
 * Canonical public origin: always https, never www.
 * Prefer NEXT_PUBLIC_APP_URL when set, but normalise host/protocol so
 * Search Console signals consolidate on https://glow-uk.com.
 */
export function canonicalAppUrl(raw = process.env.NEXT_PUBLIC_APP_URL): string {
  const fallback = "https://glow-uk.com";
  try {
    const u = new URL((raw || fallback).trim());
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "localhost" || host.endsWith(".vercel.app")) {
      // Keep preview/local origins as-is (https when possible).
      if (host === "localhost") return u.origin;
      u.protocol = "https:";
      u.port = "";
      return u.origin;
    }
    if (host === "glow-uk.com" || host.endsWith(".glow-uk.com")) {
      host = "glow-uk.com";
    }
    return `https://${host}`;
  } catch {
    return fallback;
  }
}

export const APP_URL = canonicalAppUrl();

export const ORGANIZATION = {
  name: "Glow",
  legalName: "Glow",
  url: APP_URL,
  logoUrl: `${APP_URL}/icon.png`,
  email: "support@glow-uk.com",
  description:
    "Glow is the booking platform built for UK lash, brow and nail techs. £19 a month, everything included, 0% commission.",
  sameAs: [] as string[],
} as const;

/** Manual aggregate rating for SoftwareApplication schema. Update when Trustpilot/reviews change. */
export const GLOW_AGGREGATE_RATING = {
  ratingValue: 5,
  bestRating: 5,
  worstRating: 1,
  ratingCount: 24,
  reviewCount: 24,
} as const;

export const SOFTWARE_APPLICATION = {
  name: "Glow",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: ORGANIZATION.description,
  url: APP_URL,
  offers: {
    price: "19.00",
    priceCurrency: "GBP",
  },
} as const;

export type PricingFaq = { question: string; answer: string };

export const PRICING_FAQS: PricingFaq[] = [
  {
    question: "How much does Glow cost?",
    answer:
      "Glow is £19 a month flat, everything included. No per-staff fees, no marketplace commission, no bolt-ons. First month is half price (£9.50) while the launch offer is on.",
  },
  {
    question: "Is there commission on bookings?",
    answer:
      "No. Glow takes 0% of what your clients pay you. Deposits and balances go straight into your own Stripe account.",
  },
  {
    question: "Are staff seats extra?",
    answer: "No. Unlimited staff are included in the £19 monthly plan.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. There are no contracts. Cancel from Billing whenever you like.",
  },
  {
    question: "Is migration free?",
    answer:
      "Yes. If you are switching from Fresha, Booksy or another system, we import your clients, services and bookings for free.",
  },
  {
    question: "What is included for £19?",
    answer:
      "Your booking page, deposits and card on file, reminders, waitlists, loyalty, vouchers, reviews, patch tests, infills, consent and aftercare, multi-staff and reports.",
  },
];

const CATEGORY_SKIP =
  /^(other|imported|patch\s*test|consultations?|courses?|aftercare|add[- ]?ons?)$/i;

/** Strip emoji / odd symbols from category labels for SERP titles. */
export function cleanCategoryLabel(name: string): string {
  return name
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick a few primary service categories for titles/descriptions.
 * Prefers lash/brow/nail/piercing style labels; skips junk categories.
 */
export function primaryCategoryLabels(
  categories: { name: string }[],
  max = 3,
): string[] {
  const cleaned = categories
    .map((c) => cleanCategoryLabel(c.name))
    .filter((n) => n.length > 1 && !CATEGORY_SKIP.test(n));

  const score = (n: string) => {
    const lower = n.toLowerCase();
    if (/lash/.test(lower)) return 100;
    if (/brow/.test(lower)) return 90;
    if (/nail|mani|pedi/.test(lower)) return 80;
    if (/pierc/.test(lower)) return 70;
    if (/wax|facial|massage|beauty/.test(lower)) return 40;
    return 10;
  };

  const unique: string[] = [];
  for (const n of [...cleaned].sort((a, b) => score(b) - score(a) || a.localeCompare(b))) {
    if (unique.some((u) => u.toLowerCase() === n.toLowerCase())) continue;
    unique.push(n);
    if (unique.length >= max) break;
  }
  return unique;
}

function joinPhrase(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Extract a short town/locality from a free-text location field. */
export function townFromLocation(location: string | null | undefined): string | null {
  const raw = (location ?? "").trim();
  if (!raw) return null;
  // "Manchester, UK" → Manchester; "Ballymena" → Ballymena
  const primary = raw.split(",")[0]?.trim() ?? raw;
  if (!primary || /^uk$/i.test(primary) || /^united kingdom$/i.test(primary)) return null;
  return primary.slice(0, 80);
}

/**
 * SERP title: "{Business Name}, {Town} | {Categories} | Book Online"
 * Omits empty town / category segments without leaving blank placeholders.
 */
export function bookingPageTitle(input: {
  businessName: string;
  location?: string | null;
  categories?: { name: string }[];
}): string {
  const name = input.businessName.trim() || "Beauty studio";
  const town = townFromLocation(input.location);
  const cats = primaryCategoryLabels(input.categories ?? [], 3);
  const head = town ? `${name}, ${town}` : name;
  const mid = cats.length ? joinPhrase(cats) : null;
  return mid ? `${head} | ${mid} | Book Online` : `${head} | Book Online`;
}

/**
 * Meta description from services/categories + location.
 * Example: "Book lash extensions, nails and brows with Allure Beauty in Devizes. Online booking, instant confirmation."
 */
export function bookingPageDescription(input: {
  businessName: string;
  location?: string | null;
  categories?: { name: string }[];
  services?: { name: string }[];
}): string {
  const name = input.businessName.trim() || "this studio";
  const town = townFromLocation(input.location);
  const cats = primaryCategoryLabels(input.categories ?? [], 3);
  let offer = cats.length ? joinPhrase(cats.map((c) => c.toLowerCase())) : "";
  if (!offer && input.services?.length) {
    offer = joinPhrase(
      input.services
        .slice(0, 3)
        .map((s) => cleanCategoryLabel(s.name).toLowerCase())
        .filter(Boolean),
    );
  }
  if (!offer) offer = "beauty treatments";

  const where = town ? ` in ${town}` : "";
  return `Book ${offer} with ${name}${where}. Online booking, instant confirmation.`.slice(0, 160);
}

/** Absolute canonical URL for a path on the apex https host. */
export function absoluteCanonical(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL}${p === "/" ? "" : p}` || APP_URL;
}
