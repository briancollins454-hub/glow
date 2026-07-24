/** Shared SEO constants for metadata and JSON-LD. */

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com").replace(/\/$/, "");

export const ORGANIZATION = {
  name: "Glow",
  legalName: "Glow",
  url: APP_URL,
  logoUrl: `${APP_URL}/icon.png`,
  email: "support@glow-uk.com",
  description:
    "The booking platform built for UK lash, brow and nail techs. £19 a month, everything included, 0% commission.",
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

/** Extract a short town/locality from a free-text location field. */
export function townFromLocation(location: string | null | undefined): string | null {
  const raw = (location ?? "").trim();
  if (!raw) return null;
  // "Manchester, UK" → Manchester; "Ballymena" → Ballymena
  const primary = raw.split(",")[0]?.trim() ?? raw;
  if (!primary || /^uk$/i.test(primary) || /^united kingdom$/i.test(primary)) return null;
  return primary.slice(0, 80);
}

export function bookingPageTitle(businessName: string, location?: string | null): string {
  const town = townFromLocation(location);
  const name = businessName.trim() || "this studio";
  return town ? `Book with ${name} | ${town}` : `Book with ${name}`;
}

export function bookingPageDescription(input: {
  businessName: string;
  location?: string | null;
  tagline?: string | null;
  bio?: string | null;
  cardCapture?: boolean;
}): string {
  const town = townFromLocation(input.location);
  const tag = input.tagline?.trim();
  if (tag) return tag.slice(0, 160);
  const bio = input.bio?.trim();
  if (bio) return bio.replace(/\s+/g, " ").slice(0, 160);
  const where = town ? ` in ${town}` : "";
  const deposit = input.cardCapture
    ? "No deposit needed to book."
    : "Secure your slot with a deposit.";
  return `Book ${input.businessName}${where} online. ${deposit} Powered by Glow.`.slice(0, 160);
}
