import {
  APP_URL,
  GLOW_AGGREGATE_RATING,
  ORGANIZATION,
  SOFTWARE_APPLICATION,
  townFromLocation,
  type PricingFaq,
} from "@/lib/seo/config";

type JsonLd = Record<string, unknown>;

export type OpeningHoursSpecInput = {
  /** 0 = Sunday … 6 = Saturday (matches Glow working_hours.weekday). */
  weekday: number;
  opens: string; // HH:MM
  closes: string; // HH:MM
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: ORGANIZATION.url,
    logo: ORGANIZATION.logoUrl,
    email: ORGANIZATION.email,
    description: ORGANIZATION.description,
    ...(ORGANIZATION.sameAs.length ? { sameAs: [...ORGANIZATION.sameAs] } : {}),
  };
}

export function softwareApplicationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SOFTWARE_APPLICATION.name,
    applicationCategory: SOFTWARE_APPLICATION.applicationCategory,
    operatingSystem: SOFTWARE_APPLICATION.operatingSystem,
    description: SOFTWARE_APPLICATION.description,
    url: SOFTWARE_APPLICATION.url,
    offers: {
      "@type": "Offer",
      price: SOFTWARE_APPLICATION.offers.price,
      priceCurrency: SOFTWARE_APPLICATION.offers.priceCurrency,
      url: `${APP_URL}/pricing`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: GLOW_AGGREGATE_RATING.ratingValue,
      bestRating: GLOW_AGGREGATE_RATING.bestRating,
      worstRating: GLOW_AGGREGATE_RATING.worstRating,
      ratingCount: GLOW_AGGREGATE_RATING.ratingCount,
      reviewCount: GLOW_AGGREGATE_RATING.reviewCount,
    },
    provider: {
      "@type": "Organization",
      name: ORGANIZATION.name,
      url: ORGANIZATION.url,
    },
  };
}

export function faqPageJsonLd(faqs: PricingFaq[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path.startsWith("http") ? item.path : `${APP_URL}${item.path}`,
    })),
  };
}

export function localBusinessJsonLd(input: {
  name: string;
  description?: string;
  url: string;
  location?: string | null;
  image?: string | null;
  services: { name: string; pricePennies?: number }[];
  openingHours?: OpeningHoursSpecInput[];
}): JsonLd {
  const location = (input.location ?? "").trim();
  const town = townFromLocation(location);
  const schema: JsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${input.url}#business`,
    name: input.name,
    url: input.url,
    description: input.description?.slice(0, 300) || undefined,
    image: input.image || undefined,
  };
  if (town || location) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: town || undefined,
      addressCountry: "GB",
      ...(location && location !== town ? { streetAddress: location } : {}),
    };
  }
  if (input.services.length) {
    schema.makesOffer = input.services.slice(0, 40).map((s) => ({
      "@type": "Offer",
      url: input.url,
      itemOffered: {
        "@type": "Service",
        name: s.name,
      },
      ...(typeof s.pricePennies === "number"
        ? {
            price: (s.pricePennies / 100).toFixed(2),
            priceCurrency: "GBP",
          }
        : {}),
    }));
  }
  if (input.openingHours?.length) {
    schema.openingHoursSpecification = input.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_NAMES[h.weekday] ?? "Monday",
      opens: h.opens,
      closes: h.closes,
    }));
  }
  return schema;
}

/** Serialize JSON-LD for a script tag (escapes `<` to avoid XSS in HTML). */
export function stringifyJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
