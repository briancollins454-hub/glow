/**
 * Salon locale helpers (currency, country, timezone).
 * Fallbacks keep existing GB behaviour until migration 0062 is applied and settings are saved.
 */

export const DEFAULT_CURRENCY = "GBP";
export const DEFAULT_COUNTRY = "GB";
export const DEFAULT_TZ = "Europe/London";

/**
 * Glow's own platform reporting timezone (traffic, owner overview, page views).
 * Must never be swapped for a salon timezone.
 */
export const PLATFORM_TZ = "Europe/London";

export type SalonLocale = {
  currency: string;
  country: string;
  timezone: string;
};

/** Narrow shape so this works with Tech, PublicTech, or any partial. */
type LocaleSource = {
  currency?: string | null;
  country?: string | null;
  timezone?: string | null;
};

function nonempty(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export function salonLocale(source: LocaleSource | null | undefined): SalonLocale {
  return {
    currency: salonCurrency(source),
    country: salonCountry(source),
    timezone: salonTz(source),
  };
}

export function salonCurrency(source: LocaleSource | null | undefined): string {
  return nonempty(source?.currency) ?? DEFAULT_CURRENCY;
}

export function salonTz(source: LocaleSource | null | undefined): string {
  return nonempty(source?.timezone) ?? DEFAULT_TZ;
}

export function salonCountry(source: LocaleSource | null | undefined): string {
  return nonempty(source?.country) ?? DEFAULT_COUNTRY;
}

export type CurrencyOption = {
  code: string;
  locale: string;
  label: string;
  digits: 0 | 2;
};

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

function currency(
  code: string,
  locale: string,
  label: string,
): CurrencyOption {
  return {
    code,
    locale,
    label,
    digits: ZERO_DECIMAL.has(code) ? 0 : 2,
  };
}

export const CURRENCIES: CurrencyOption[] = [
  currency("GBP", "en-GB", "British pound (£)"),
  currency("EUR", "en-IE", "Euro (€)"),
  currency("USD", "en-US", "US dollar ($)"),
  currency("AUD", "en-AU", "Australian dollar (A$)"),
  currency("NZD", "en-NZ", "New Zealand dollar (NZ$)"),
  currency("CAD", "en-CA", "Canadian dollar (CA$)"),
  currency("CHF", "de-CH", "Swiss franc (CHF)"),
  currency("SEK", "sv-SE", "Swedish krona (kr)"),
  currency("NOK", "nb-NO", "Norwegian krone (kr)"),
  currency("DKK", "da-DK", "Danish krone (kr)"),
  currency("PLN", "pl-PL", "Polish złoty (zł)"),
  currency("CZK", "cs-CZ", "Czech koruna (Kč)"),
  currency("AED", "en-AE", "UAE dirham (AED)"),
  currency("ZAR", "en-ZA", "South African rand (R)"),
  currency("SGD", "en-SG", "Singapore dollar (S$)"),
  currency("HKD", "en-HK", "Hong Kong dollar (HK$)"),
  currency("JPY", "ja-JP", "Japanese yen (¥)"),
  currency("KRW", "ko-KR", "South Korean won (₩)"),
  currency("INR", "en-IN", "Indian rupee (₹)"),
  currency("MXN", "es-MX", "Mexican peso (MX$)"),
  currency("BRL", "pt-BR", "Brazilian real (R$)"),
];

export const COUNTRIES: { code: string; name: string; defaultCurrency: string }[] = [
  { code: "GB", name: "United Kingdom", defaultCurrency: "GBP" },
  { code: "IE", name: "Ireland", defaultCurrency: "EUR" },
  { code: "US", name: "United States", defaultCurrency: "USD" },
  { code: "AU", name: "Australia", defaultCurrency: "AUD" },
  { code: "NZ", name: "New Zealand", defaultCurrency: "NZD" },
  { code: "CA", name: "Canada", defaultCurrency: "CAD" },
  { code: "DE", name: "Germany", defaultCurrency: "EUR" },
  { code: "FR", name: "France", defaultCurrency: "EUR" },
  { code: "ES", name: "Spain", defaultCurrency: "EUR" },
  { code: "IT", name: "Italy", defaultCurrency: "EUR" },
  { code: "NL", name: "Netherlands", defaultCurrency: "EUR" },
  { code: "BE", name: "Belgium", defaultCurrency: "EUR" },
  { code: "PT", name: "Portugal", defaultCurrency: "EUR" },
  { code: "AT", name: "Austria", defaultCurrency: "EUR" },
  { code: "CH", name: "Switzerland", defaultCurrency: "CHF" },
  { code: "SE", name: "Sweden", defaultCurrency: "SEK" },
  { code: "NO", name: "Norway", defaultCurrency: "NOK" },
  { code: "DK", name: "Denmark", defaultCurrency: "DKK" },
  { code: "PL", name: "Poland", defaultCurrency: "PLN" },
  { code: "CZ", name: "Czechia", defaultCurrency: "CZK" },
  { code: "AE", name: "United Arab Emirates", defaultCurrency: "AED" },
  { code: "ZA", name: "South Africa", defaultCurrency: "ZAR" },
  { code: "SG", name: "Singapore", defaultCurrency: "SGD" },
  { code: "HK", name: "Hong Kong", defaultCurrency: "HKD" },
  { code: "JP", name: "Japan", defaultCurrency: "JPY" },
  { code: "KR", name: "South Korea", defaultCurrency: "KRW" },
  { code: "IN", name: "India", defaultCurrency: "INR" },
  { code: "MX", name: "Mexico", defaultCurrency: "MXN" },
  { code: "BR", name: "Brazil", defaultCurrency: "BRL" },
];

export const TIMEZONES: { group: string; zones: string[] }[] = [
  {
    group: "Europe",
    zones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Amsterdam",
      "Europe/Brussels",
      "Europe/Madrid",
      "Europe/Rome",
      "Europe/Lisbon",
      "Europe/Vienna",
      "Europe/Zurich",
      "Europe/Stockholm",
      "Europe/Oslo",
      "Europe/Copenhagen",
      "Europe/Warsaw",
      "Europe/Prague",
    ],
  },
  {
    group: "Americas",
    zones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Toronto",
      "America/Vancouver",
      "America/Mexico_City",
      "America/Sao_Paulo",
    ],
  },
  {
    group: "Asia Pacific",
    zones: [
      "Australia/Sydney",
      "Australia/Melbourne",
      "Australia/Brisbane",
      "Australia/Perth",
      "Pacific/Auckland",
      "Asia/Singapore",
      "Asia/Hong_Kong",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Asia/Kolkata",
    ],
  },
  {
    group: "Middle East & Africa",
    zones: ["Asia/Dubai", "Africa/Johannesburg", "Africa/Lagos", "Africa/Cairo"],
  },
];

const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));
const ZONE_SET = new Set(TIMEZONES.flatMap((g) => g.zones));

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_CODES.has(code);
}

export function isSupportedCountry(code: string): boolean {
  return COUNTRY_CODES.has(code);
}

export function isSupportedTimezone(tz: string): boolean {
  return ZONE_SET.has(tz);
}

/** Map a browser IANA zone to country + currency for signup prefill. */
export function localeFromTimezone(tzRaw: string | null | undefined): SalonLocale {
  const tz = nonempty(tzRaw);
  if (!tz) {
    return { currency: DEFAULT_CURRENCY, country: DEFAULT_COUNTRY, timezone: DEFAULT_TZ };
  }

  const map: Record<string, { country: string; currency: string }> = {
    "Europe/London": { country: "GB", currency: "GBP" },
    "Europe/Dublin": { country: "IE", currency: "EUR" },
    "Europe/Paris": { country: "FR", currency: "EUR" },
    "Europe/Berlin": { country: "DE", currency: "EUR" },
    "Europe/Amsterdam": { country: "NL", currency: "EUR" },
    "Europe/Brussels": { country: "BE", currency: "EUR" },
    "Europe/Madrid": { country: "ES", currency: "EUR" },
    "Europe/Rome": { country: "IT", currency: "EUR" },
    "Europe/Lisbon": { country: "PT", currency: "EUR" },
    "Europe/Vienna": { country: "AT", currency: "EUR" },
    "Europe/Zurich": { country: "CH", currency: "CHF" },
    "Europe/Stockholm": { country: "SE", currency: "SEK" },
    "Europe/Oslo": { country: "NO", currency: "NOK" },
    "Europe/Copenhagen": { country: "DK", currency: "DKK" },
    "Europe/Warsaw": { country: "PL", currency: "PLN" },
    "Europe/Prague": { country: "CZ", currency: "CZK" },
    "America/New_York": { country: "US", currency: "USD" },
    "America/Chicago": { country: "US", currency: "USD" },
    "America/Denver": { country: "US", currency: "USD" },
    "America/Los_Angeles": { country: "US", currency: "USD" },
    "America/Toronto": { country: "CA", currency: "CAD" },
    "America/Vancouver": { country: "CA", currency: "CAD" },
    "America/Mexico_City": { country: "MX", currency: "MXN" },
    "America/Sao_Paulo": { country: "BR", currency: "BRL" },
    "Australia/Sydney": { country: "AU", currency: "AUD" },
    "Australia/Melbourne": { country: "AU", currency: "AUD" },
    "Australia/Brisbane": { country: "AU", currency: "AUD" },
    "Australia/Perth": { country: "AU", currency: "AUD" },
    "Pacific/Auckland": { country: "NZ", currency: "NZD" },
    "Asia/Singapore": { country: "SG", currency: "SGD" },
    "Asia/Hong_Kong": { country: "HK", currency: "HKD" },
    "Asia/Tokyo": { country: "JP", currency: "JPY" },
    "Asia/Seoul": { country: "KR", currency: "KRW" },
    "Asia/Kolkata": { country: "IN", currency: "INR" },
    "Asia/Dubai": { country: "AE", currency: "AED" },
    "Africa/Johannesburg": { country: "ZA", currency: "ZAR" },
  };

  const hit = map[tz];
  const timezone = isSupportedTimezone(tz) ? tz : DEFAULT_TZ;
  if (!hit) {
    return { currency: DEFAULT_CURRENCY, country: DEFAULT_COUNTRY, timezone };
  }
  return {
    currency: isSupportedCurrency(hit.currency) ? hit.currency : DEFAULT_CURRENCY,
    country: isSupportedCountry(hit.country) ? hit.country : DEFAULT_COUNTRY,
    timezone,
  };
}
