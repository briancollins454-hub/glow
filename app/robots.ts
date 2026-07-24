import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/seo/config";

/**
 * Crawl rules:
 * - Allow marketing + public booking pages
 * - Disallow private / tokenised / API surfaces
 * - Disallow query-string variants of booking pages (?service= etc) to avoid duplicate content
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/dashboard/",
        "/m/",
        "/pay/",
        "/api/",
        "/*/booked/",
        "/tester",
        // Booking page deep-links with query params (same content as clean /{handle}).
        "/*?*service=",
        "/*?*staff=",
        "/*?*date=",
        "/*?*slot=",
        "/*?*also=",
        "/*?*pair=",
        "/*?*patchSlot=",
        "/*?*category=",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
