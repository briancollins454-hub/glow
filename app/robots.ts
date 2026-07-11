import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, tokenised or auth-only surfaces stay out of search results.
      disallow: ["/dashboard", "/m/", "/pay/", "/api/", "/*/booked/", "/tester"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
