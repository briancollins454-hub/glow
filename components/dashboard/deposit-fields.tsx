"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/input";
import { useCurrency } from "@/components/locale/locale-provider";
import { currencySymbol, minorUnitFactor } from "@/lib/money";
import type { DepositType } from "@/lib/db/types";

type AmountMode = DepositType | "percent" | "fixed" | "none";

/**
 * Amount picker in the salon's currency. The amount box transforms with the
 * type: currency-symbol prefix for a set amount, % suffix for a percentage,
 * hidden for "none".
 */
export function DepositFields({
  defaultType,
  defaultValue,
  nameType = "depositType",
  nameValue = "depositValue",
  label = "Deposit",
  allowNone = true,
  percentHint,
  fixedHint,
}: {
  defaultType: AmountMode;
  /** Display value for the input (percent as "30", fixed as major units "15.00"). */
  defaultValue: string;
  nameType?: string;
  nameValue?: string;
  label?: string;
  allowNone?: boolean;
  percentHint?: string;
  fixedHint?: string;
}) {
  const [type, setType] = useState<AmountMode>(defaultType);
  const symbol = currencySymbol(useCurrency());

  return (
    <>
      <div>
        <Label>{label}</Label>
        <Select
          name={nameType}
          value={type}
          onChange={(e) => setType(e.target.value as AmountMode)}
        >
          <option value="fixed">Set amount ({symbol})</option>
          <option value="percent">Percentage (%)</option>
          {allowNone && <option value="none">No deposit</option>}
        </Select>
      </div>
      {type === "none" ? (
        <div className="flex items-end">
          <p className="w-full rounded-xl border border-edge bg-fill px-3.5 py-2.5 text-sm text-ink-faint">
            No deposit - clients book without paying anything upfront.
          </p>
          <input type="hidden" name={nameValue} value="0" />
        </div>
      ) : (
        <div>
          <Label>{type === "fixed" ? `Amount (${symbol})` : "Percentage (%)"}</Label>
          <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-fill px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
            {type === "fixed" && <span className="text-base font-semibold text-brand-text">{symbol}</span>}
            <input
              key={type}
              name={nameValue}
              type="text"
              inputMode="decimal"
              defaultValue={defaultValue}
              placeholder={type === "fixed" ? "15.00" : "30"}
              className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-ink-faint sm:text-sm"
            />
            {type === "percent" && <span className="text-base font-semibold text-brand-text">%</span>}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {type === "fixed"
              ? fixedHint ?? `Exact amount, e.g. 15.00 = ${symbol}15.`
              : percentHint ?? `Share of the price, e.g. 30 = 30%. On a ${symbol}50 service that's ${symbol}15.`}
          </p>
        </div>
      )}
    </>
  );
}

/** Format a stored value for the DepositFields input. */
export function depositFieldDisplay(
  type: AmountMode | null | undefined,
  value: number | null | undefined,
  fallbackPct: number,
  currency?: string | null,
): { type: AmountMode; display: string } {
  const t = type ?? "percent";
  if (t === "fixed") {
    const minorUnits = value ?? 0;
    const factor = minorUnitFactor(currency ?? "GBP");
    return {
      type: "fixed",
      display: factor === 1 ? String(minorUnits) : (minorUnits / factor).toFixed(2),
    };
  }
  if (t === "none") return { type: "none", display: "0" };
  return { type: "percent", display: String(value ?? fallbackPct) };
}
