import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { formatInTimeZone } from "date-fns-tz";
import { randomId } from "@/lib/ids";
import { checkLimit } from "@/lib/rate-limit";
import { supabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const TZ = "Europe/London";
const BOT_RE =
  /bot|crawl|spider|slurp|preview|headless|wget|curl|python-requests|scrapy|mediapartners|facebookexternalhit|whatsapp|telegrambot|linkedinbot|twitterbot|bingpreview|googlebot|applebot|semrush|ahrefs|petalbot|bytespider/i;

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_RE.test(userAgent);
}

function visitorHash(ip: string, userAgent: string | null): string {
  const day = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  return createHash("sha256")
    .update(`${ip}|${userAgent ?? ""}|${day}`)
    .digest("hex")
    .slice(0, 32);
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

type Body = {
  path?: unknown;
  techId?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

function asShortString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Client beacon endpoint for real page views.
 * Public pages are ISR-cached; server-side after() tracking only fired on
 * regeneration, which is why owner traffic showed 0.
 */
export async function POST(req: Request) {
  try {
    const userAgent = req.headers.get("user-agent");
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }

    const ip = clientIp(req);
    if (!checkLimit(`pageview:${ip}`, 120, 60_000).ok) {
      return NextResponse.json({ ok: true, skipped: "rate" });
    }

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "bad json" }, { status: 400 });
    }

    const path = asShortString(body.path, 300);
    if (!path || !path.startsWith("/")) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    // Only allow public/marketing paths (never dashboard).
    if (path.startsWith("/dashboard") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true, skipped: "internal" });
    }

    const techId = asShortString(body.techId, 64);
    const referrer =
      asShortString(body.referrer, 500) ??
      asShortString(req.headers.get("referer"), 500);
    const utmSource = asShortString(body.utmSource, 100);
    const utmMedium = asShortString(body.utmMedium, 100);
    const utmCampaign = asShortString(body.utmCampaign, 100);

    const sb = supabaseService();
    await sb.from("page_views").insert({
      id: randomId("pv"),
      techId,
      path,
      visitorHash: visitorHash(ip, userAgent),
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics must never break the client.
    return NextResponse.json({ ok: true, skipped: "error" });
  }
}
