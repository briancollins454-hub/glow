import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarHeart, Clock, Sparkles } from "lucide-react";
import { supabaseService } from "@/lib/supabase/service";
import { getDmQuoteLinkByToken, getService, getTechById, updateDmQuoteLink } from "@/lib/db/queries";
import { bookUrl, parseQuoteAddons } from "@/lib/dm-quote";
import { gbp, minutesToLabel } from "@/lib/format";
import { isLive } from "@/lib/subscriptions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export const metadata = { title: "Your quote", robots: { index: false, follow: false } };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = supabaseService();
  const quote = await getDmQuoteLinkByToken(sb, token);
  if (!quote) notFound();

  const [tech, service] = await Promise.all([
    getTechById(sb, quote.techId),
    getService(sb, quote.serviceId),
  ]);
  if (!tech || !service || !isLive(tech)) notFound();

  if (!quote.viewedAtIso) {
    await updateDmQuoteLink(sb, quote.id, { viewedAtIso: new Date().toISOString() });
  }

  const brand = tech.brandColor || "#db2777";
  const addons = parseQuoteAddons(quote.addons);
  const book = bookUrl(tech.handle, service.id, quote.token, APP_URL);
  const greeting = quote.clientName?.trim()
    ? `Hi ${quote.clientName.trim().split(" ")[0]}, here's your quote`
    : "Your quote";

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card overflow-hidden">
          <div className="px-6 py-7 text-white" style={{ backgroundColor: brand }}>
            <p className="text-sm text-white/80">{tech.businessName}</p>
            <h1 className="font-display text-2xl font-semibold">{greeting}</h1>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="font-display text-xl font-semibold text-ink">{service.name}</p>
              <p className="mt-1 flex items-center gap-3 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {minutesToLabel(service.durationMin)}
                </span>
                <span className="font-medium text-ink">{gbp(quote.pricePennies)}</span>
              </p>
            </div>

            {addons.length > 0 && (
              <div className="rounded-xl border border-edge bg-cream px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles className="h-4 w-4 text-brand-300" />
                  Includes
                </p>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  {addons.map((a) => (
                    <li key={a.name}>
                      {a.name} {a.pricePennies > 0 ? `(+${gbp(a.pricePennies)})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {quote.depositPennies > 0 && (
              <p className="text-sm text-ink-soft">
                <strong className="text-ink">{gbp(quote.depositPennies)} deposit</strong> secures your slot.
                The rest is due on the day.
              </p>
            )}

            {quote.note?.trim() && (
              <p className="whitespace-pre-wrap rounded-xl border border-edge bg-cream px-4 py-3 text-sm text-ink-soft">
                {quote.note.trim()}
              </p>
            )}

            <Link
              href={book}
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: brand }}
            >
              Book now
            </Link>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <CalendarHeart className="h-3.5 w-3.5" /> Powered by Glow
        </p>
      </div>
    </div>
  );
}
