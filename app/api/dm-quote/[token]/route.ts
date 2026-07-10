import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/session";
import { buildDmQuoteCopy, quoteUrl, parseQuoteAddons } from "@/lib/dm-quote";
import { getDmQuoteLinkByToken, getService } from "@/lib/db/queries";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const quote = await getDmQuoteLinkByToken(ctx.sb, token);
  if (!quote || quote.techId !== ctx.tech.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const service = await getService(ctx.sb, quote.serviceId);
  if (!service) return NextResponse.json({ error: "not found" }, { status: 404 });

  const addons = parseQuoteAddons(quote.addons);
  const url = quoteUrl(quote.token, APP_URL);
  const copy = buildDmQuoteCopy(ctx.tech, quote, service, addons, url);

  return NextResponse.json({
    quote,
    service: { id: service.id, name: service.name, durationMin: service.durationMin },
    url,
    copy,
  });
}
