/**
 * Server-side page-view helpers.
 *
 * IMPORTANT: Do not call trackPageView from ISR-cached public pages
 * (landing revalidate=3600, booking revalidate=60). Those only re-run on
 * cache regeneration, so traffic looked like 0. Real visits are recorded by
 * PageViewBeacon -> POST /api/t.
 *
 * Keep this module for any fully-dynamic server routes that still want
 * after()-based tracking.
 */

import { createHash } from "crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { formatInTimeZone } from "date-fns-tz";
import { callerIp } from "@/lib/rate-limit";
import { randomId } from "@/lib/ids";
import { supabaseService } from "@/lib/supabase/service";

const TZ = "Europe/London";

const BOT_RE =
  /bot|crawl|spider|slurp|preview|headless|wget|curl|python-requests|scrapy|mediapartners|facebookexternalhit|whatsapp|telegrambot|linkedinbot|twitterbot|bingpreview|googlebot|applebot|semrush|ahrefs|petalbot|bytespider/i;

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_RE.test(userAgent);
}

async function visitorHash(ip: string, userAgent: string | null): Promise<string> {
  const day = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  return createHash("sha256")
    .update(`${ip}|${userAgent ?? ""}|${day}`)
    .digest("hex")
    .slice(0, 32);
}

export type PageViewInput = {
  techId?: string | null;
  path: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

async function recordPageView(opts: PageViewInput): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    if (isBot(userAgent)) return;

    const ip = await callerIp();
    const hash = await visitorHash(ip, userAgent);
    const referrer = opts.referrer ?? h.get("referer")?.slice(0, 500) ?? null;

    const sb = supabaseService();
    await sb.from("page_views").insert({
      id: randomId("pv"),
      techId: opts.techId ?? null,
      path: opts.path,
      visitorHash: hash,
      referrer,
      utmSource: opts.utmSource ?? null,
      utmMedium: opts.utmMedium ?? null,
      utmCampaign: opts.utmCampaign ?? null,
    });
  } catch {
    // Analytics must never break page loads.
  }
}

/** Fire-and-forget page view after the response is sent (dynamic routes only). */
export function trackPageView(opts: PageViewInput): void {
  after(() => recordPageView(opts));
}
