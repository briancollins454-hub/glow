import type { MetadataRoute } from "next";
import { supabaseService, serviceConfigured } from "@/lib/supabase/service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";
const LIVE = ["trialing", "active", "comped"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (serviceConfigured()) {
    try {
      const { data } = await supabaseService()
        .from("techs")
        .select("handle, subscriptionStatus")
        .in("subscriptionStatus", LIVE);
      for (const t of data ?? []) {
        entries.push({
          url: `${APP_URL}/${t.handle}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.9,
        });
      }
    } catch {
      // Sitemap still serves the static entries if the DB is unreachable.
    }
  }

  return entries;
}
