import { formatInTimeZone } from "date-fns-tz";
import { gbp, TZ } from "@/lib/format";
import type { Service, Tech } from "@/lib/db/types";

export type PriceRiseMode = "percent" | "fixed";

export type PriceRiseOptions = {
  mode: PriceRiseMode;
  /** Percent (e.g. 10) or fixed increase in pennies. */
  value: number;
  /** yyyy-mm-dd in Europe/London for client messaging. */
  effectiveDate?: string;
  note?: string;
};

export type PriceRisePreviewRow = {
  serviceId: string;
  name: string;
  currentPennies: number;
  newPennies: number;
  deltaPennies: number;
};

/** Round menu prices to the nearest 50p for cleaner price lists. */
export function roundToNearest50p(pennies: number): number {
  return Math.round(pennies / 50) * 50;
}

export function newPricePennies(currentPennies: number, mode: PriceRiseMode, value: number): number {
  const raw =
    mode === "percent"
      ? currentPennies * (1 + value / 100)
      : currentPennies + value;
  return Math.max(0, roundToNearest50p(Math.round(raw)));
}

export function previewPriceRise(
  services: Service[],
  serviceIds: string[],
  options: PriceRiseOptions,
): PriceRisePreviewRow[] {
  const idSet = new Set(serviceIds);
  return services
    .filter((s) => idSet.has(s.id) && s.active)
    .map((s) => {
      const newPennies = newPricePennies(s.pricePennies, options.mode, options.value);
      return {
        serviceId: s.id,
        name: s.name,
        currentPennies: s.pricePennies,
        newPennies,
        deltaPennies: newPennies - s.pricePennies,
      };
    })
    .filter((row) => row.deltaPennies !== 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatEffectiveDate(dateStr?: string): string {
  if (!dateStr?.trim()) return "soon";
  try {
    return formatInTimeZone(new Date(`${dateStr.trim()}T12:00:00Z`), TZ, "d MMMM yyyy");
  } catch {
    return dateStr;
  }
}

export type PriceRiseAnnouncement = {
  email: string;
  sms: string;
  social: string;
};

export function buildPriceRiseAnnouncement(
  tech: Pick<Tech, "businessName" | "name" | "handle">,
  options: PriceRiseOptions,
  preview: PriceRisePreviewRow[],
  appUrl: string,
): PriceRiseAnnouncement {
  const biz = tech.businessName || tech.name || "your beauty studio";
  const when = formatEffectiveDate(options.effectiveDate);
  const bookUrl = `${appUrl}/${tech.handle}`;
  const note = options.note?.trim();
  const noteLine = note ? `\n\n${note}` : "";

  const examples = preview
    .slice(0, 4)
    .map((r) => `${r.name}: ${gbp(r.currentPennies)} → ${gbp(r.newPennies)}`)
    .join("\n");
  const examplesShort = preview
    .slice(0, 3)
    .map((r) => `${r.name} ${gbp(r.newPennies)}`)
    .join(", ");

  const email =
    `Hi there,\n\n` +
    `A quick note from ${biz}: our prices are changing from ${when}.\n\n` +
    (examples ? `${examples}\n\n` : "") +
    `Appointments already booked keep their current price. New bookings from ${when} will be at the updated rates.\n\n` +
    `Book here: ${bookUrl}` +
    noteLine;

  const sms =
    `${biz}: prices update from ${when}. ` +
    (examplesShort ? `e.g. ${examplesShort}. ` : "") +
    `Existing bookings unchanged. Book: ${bookUrl}` +
    (note ? ` ${note}` : "");

  const social =
    `✨ Price update from ${when} ✨\n\n` +
    `After a lot of love for ${biz}, we're adjusting our menu prices to reflect rising product and studio costs.\n\n` +
    (examples ? `${examples.replace(/\n/g, "\n")}\n\n` : "") +
    `Already booked? Your price stays the same 💕\n\n` +
    `Book: ${bookUrl}` +
    (note ? `\n\n${note}` : "");

  return { email, sms, social };
}

export function priceRiseEmailSubjectForDate(
  tech: Pick<Tech, "businessName" | "name">,
  effectiveDate?: string,
): string {
  const biz = tech.businessName || tech.name || "Your beauty studio";
  return `${biz}: price update from ${formatEffectiveDate(effectiveDate)}`;
}
