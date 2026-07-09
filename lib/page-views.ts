import { createHash } from "crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { formatInTimeZone } from "date-fns-tz";
import { callerIp } from "@/lib/rate-limit";
import { randomId } from "@/lib/utils";
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

async function recordPageView(opts: {
  techId?: string | null;
  path: string;
}): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    if (isBot(userAgent)) return;

    const ip = await callerIp();
    const hash = await visitorHash(ip, userAgent);
    const referrer = h.get("referer")?.slice(0, 500) ?? null;

    const sb = supabaseService();
    await sb.from("page_views").insert({
      id: randomId("pv"),
      techId: opts.techId ?? null,
      path: opts.path,
      visitorHash: hash,
      referrer,
    });
  } catch {
    // Analytics must never break page loads.
  }
}

/** Fire-and-forget page view after the response is sent. */
export function trackPageView(opts: { techId?: string | null; path: string }): void {
  after(() => recordPageView(opts));
}
