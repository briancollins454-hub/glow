import { minutesToLabel } from "@/lib/format";
import { salonCurrency } from "@/lib/locale";
import { money } from "@/lib/money";
import type { BookingAddon, DmQuoteLink, Service, Tech } from "@/lib/db/types";

export function quoteUrl(token: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/q/${token}`;
}

export function bookUrl(
  handle: string,
  serviceId: string,
  quoteToken: string,
  appUrl: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/${handle}?service=${encodeURIComponent(serviceId)}&quote=${encodeURIComponent(quoteToken)}`;
}

export type DmQuoteCopy = {
  instagram: string;
  whatsapp: string;
};

export function buildDmQuoteCopy(
  tech: Pick<Tech, "businessName" | "name" | "currency"> & { clientPaymentsEnabled?: boolean | null },
  quote: Pick<DmQuoteLink, "clientName" | "pricePennies" | "depositPennies" | "note">,
  service: Pick<Service, "name" | "durationMin">,
  addons: BookingAddon[],
  url: string,
): DmQuoteCopy {
  const cur = salonCurrency(tech);
  const first = quote.clientName?.trim().split(" ")[0];
  const hi = first ? `Hi ${first}!` : "Hi!";
  const addonLine =
    addons.length > 0 ? `\nIncludes: ${addons.map((a) => a.name).join(", ")}` : "";
  const depositLine =
    quote.depositPennies > 0 && tech.clientPaymentsEnabled !== false
      ? `\n${money(quote.depositPennies, cur)} deposit secures your slot.`
      : "";
  const noteLine = quote.note?.trim() ? `\n\n${quote.note.trim()}` : "";

  const body =
    `${hi} ✨\n\n` +
    `${service.name} (${minutesToLabel(service.durationMin)}) — ${money(quote.pricePennies, cur)}` +
    `${addonLine}${depositLine}${noteLine}\n\n` +
    `Book here: ${url}`;

  return { instagram: body, whatsapp: body };
}

export function parseQuoteAddons(raw: unknown): BookingAddon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is BookingAddon => !!a && typeof a === "object" && "name" in a && "pricePennies" in a)
    .map((a) => ({
      name: String(a.name),
      pricePennies: Number(a.pricePennies) || 0,
    }));
}
