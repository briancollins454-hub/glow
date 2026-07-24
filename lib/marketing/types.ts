import type { Metadata } from "next";
import { APP_URL, absoluteCanonical } from "@/lib/seo/config";

export type MarketingTable = {
  headers: string[];
  rows: string[][];
};

export type MarketingSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  table?: MarketingTable;
};

export type MarketingPageContent = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: MarketingSection[];
  cta: { label: string; href?: string; note?: string };
  /** Optional breadcrumb trail after Home (used on vs/switch pages). */
  breadcrumbs?: { name: string; path: string }[];
};

export function marketingMetadata(page: Pick<MarketingPageContent, "path" | "title" | "description">): Metadata {
  const url = absoluteCanonical(page.path);
  const title = page.title;
  const description = page.description;
  return {
    title,
    description,
    metadataBase: new URL(APP_URL),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: "Glow",
      url,
      title: `${title} | Glow`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Glow`,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export const COMPARE_LINKS = [
  { href: "/vs/fresha", label: "Glow vs Fresha" },
  { href: "/vs/booksy", label: "Glow vs Booksy" },
  { href: "/vs/lushlane", label: "Glow vs LushLane" },
  { href: "/vs/salonbooking", label: "Glow vs SalonBooking" },
] as const;

export const SWITCH_LINKS = [
  { href: "/switch/fresha", label: "Switch from Fresha" },
  { href: "/switch/booksy", label: "Switch from Booksy" },
] as const;

export const GUIDE_LINKS = [
  { href: "/guides/best-booking-app-lash-techs-uk", label: "Best booking app for lash techs" },
  { href: "/guides/best-booking-app-nail-techs-uk", label: "Best booking app for nail techs" },
] as const;

export const MARKETING_SITEMAP_PATHS = [
  "/pricing",
  ...COMPARE_LINKS.map((l) => l.href),
  ...SWITCH_LINKS.map((l) => l.href),
  ...GUIDE_LINKS.map((l) => l.href),
] as const;
