"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY } from "@/lib/locale";
import { money } from "@/lib/money";

/**
 * Context holding the current salon's currency code so leaf components can
 * format prices without threading a prop through every intermediate layer.
 * Falls back to GBP when no provider is mounted, so nothing crashes
 * mid-migration.
 */
const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency || DEFAULT_CURRENCY}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Bound formatter for the current salon's currency: `const money = useMoney(); money(pennies)`. */
export function useMoney(): (minorUnits: number) => string {
  const currency = useContext(CurrencyContext);
  return useMemo(() => (minorUnits: number) => money(minorUnits, currency), [currency]);
}

/** Raw ISO code, for helpers that take a currency parameter (e.g. bookingPaymentSummary). */
export function useCurrency(): string {
  return useContext(CurrencyContext);
}
