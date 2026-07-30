"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY, DEFAULT_TZ } from "@/lib/locale";
import { money } from "@/lib/money";

/**
 * Context holding the current salon's locale (currency + timezone) so leaf
 * components can format prices and times without threading props through
 * every intermediate layer. Falls back to GB defaults when no provider is
 * mounted, so nothing crashes mid-migration.
 */
type LocaleValue = { currency: string; timezone: string };

const LocaleContext = createContext<LocaleValue>({
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TZ,
});

export function LocaleProvider({
  currency,
  timezone,
  children,
}: {
  currency: string;
  timezone: string;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      currency: currency || DEFAULT_CURRENCY,
      timezone: timezone || DEFAULT_TZ,
    }),
    [currency, timezone],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Bound formatter for the current salon's currency: `const money = useMoney(); money(pennies)`. */
export function useMoney(): (minorUnits: number) => string {
  const { currency } = useContext(LocaleContext);
  return useMemo(() => (minorUnits: number) => money(minorUnits, currency), [currency]);
}

/** Raw ISO code, for helpers that take a currency parameter (e.g. bookingPaymentSummary). */
export function useCurrency(): string {
  return useContext(LocaleContext).currency;
}

/** The salon's IANA timezone, for fmtDate/fmtTime/dateStrInTz calls in client components. */
export function useSalonTz(): string {
  return useContext(LocaleContext).timezone;
}
