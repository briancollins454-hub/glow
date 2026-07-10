import { gbp, minutesToLabel } from "@/lib/format";
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
  tech: Pick<Tech, "businessName" | "name">,
  quote: Pick<DmQuoteLink, "clientName" | "pricePennies" | "depositPennies" | "note">,
  service: Pick<Service, "name" | "durationMin">,
  addons: BookingAddon[],
  url: string,
): DmQuoteCopy {
  const first = quote.clientName?.trim().split(" ")[0];
  const hi = first ? `Hi ${first}!` : "Hi!";
  const addonLine =
    addons.length > 0 ? `\nIncludes: ${addons.map((a) => a.name).join(", ")}` : "";
  const depositLine =
    quote.depositPennies > 0
      ? `\n${gbp(quote.depositPennies)} deposit secures your slot.`
      : "";
  const noteLine = quote.note?.trim() ? `\n\n${quote.note.trim()}` : "";

  const body =
    `${hi} ✨\n\n` +
    `${service.name} (${minutesToLabel(service.durationMin)}) — ${gbp(quote.pricePennies)}` +
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
