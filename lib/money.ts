/**
 * Currency-aware money helpers for salon-facing and client-facing prices only
 * (service prices, deposits, balances, payments). Glow's own subscription
 * pricing is always GBP and must never use these helpers — see lib/stripe.ts
 * and the marketing/billing pages, which keep their £ literals.
 *
 * Amounts are stored as integer minor units of the salon's currency
 * (pennies for GBP, cents for AUD, whole yen for JPY).
 */

import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyOption } from "@/lib/locale";

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Resolve a currency code to its option, falling back to the GBP default. */
function currencyOption(currency?: string | null): CurrencyOption {
  const code = (currency ?? "").trim().toUpperCase();
  return BY_CODE.get(code) ?? (BY_CODE.get(DEFAULT_CURRENCY) as CurrencyOption);
}

/** How many minor units make one major unit (100 for GBP, 1 for JPY). */
export function minorUnitFactor(currency: string): number {
  return currencyOption(currency).digits === 0 ? 1 : 100;
}

/**
 * Format integer minor units in the salon's currency, using that currency's
 * own locale so an Australian tech and her clients see "$50.00" not "A$50.00".
 */
export function money(minorUnits: number, currency?: string | null): string {
  const opt = currencyOption(currency);
  return new Intl.NumberFormat(opt.locale, {
    style: "currency",
    currency: opt.code,
  }).format((minorUnits ?? 0) / minorUnitFactor(opt.code));
}

/**
 * Parse a typed price into integer minor units of the given currency.
 *
 * Decimal separator rule: if the value contains both "." and ",", whichever
 * appears last is the decimal separator and the other marks thousands. With
 * only one separator kind, a single occurrence followed by one or two digits
 * at the end is a decimal separator ("50.5" and "50.50" both mean 50½);
 * anything else ("1,234", "1.234.567") marks thousands.
 */
export function toMinorUnits(value: string | number, currency?: string | null): number {
  const factor = minorUnitFactor(currencyOption(currency).code);
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * factor) : 0;
  }

  const raw = String(value);
  const negative = /-/.test(raw);
  // Drop currency symbols, letters and spaces; keep digits and separators.
  const s = raw.replace(/[^0-9.,]/g, "");
  if (!/[0-9]/.test(s)) return 0;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  let normalized: string;

  if (hasDot && hasComma) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const first = s.indexOf(sep);
    const last = s.lastIndexOf(sep);
    const after = s.slice(last + 1);
    if (first === last && /^[0-9]{1,2}$/.test(after)) {
      normalized = `${s.slice(0, last)}.${after}`;
    } else {
      normalized = s.split(sep).join("");
    }
  } else {
    normalized = s;
  }

  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * factor) * (negative ? -1 : 1);
}

/** Lowercase ISO code for Stripe API calls. */
export function stripeCurrency(currency?: string | null): string {
  return currencyOption(currency).code.toLowerCase();
}

/** The currency's symbol in its own locale ("£", "$", "kr"), for input adornments. */
export function currencySymbol(currency?: string | null): string {
  const opt = currencyOption(currency);
  const parts = new Intl.NumberFormat(opt.locale, {
    style: "currency",
    currency: opt.code,
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? opt.code;
}
