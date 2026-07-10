"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/input";
import type { DepositType } from "@/lib/db/types";

type AmountMode = DepositType | "percent" | "fixed" | "none";

/**
 * £ / % amount picker. The amount box transforms with the type:
 * £ prefix for a set amount, % suffix for a percentage, hidden for "none".
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
  /** Display value for the input (percent as "30", fixed as pounds "15.00"). */
  defaultValue: string;
  nameType?: string;
  nameValue?: string;
  label?: string;
  allowNone?: boolean;
  percentHint?: string;
  fixedHint?: string;
}) {
  const [type, setType] = useState<AmountMode>(defaultType);

  return (
    <>
      <div>
        <Label>{label}</Label>
        <Select
          name={nameType}
          value={type}
          onChange={(e) => setType(e.target.value as AmountMode)}
        >
          <option value="fixed">Set amount (£)</option>
          <option value="percent">Percentage (%)</option>
          {allowNone && <option value="none">No deposit</option>}
        </Select>
      </div>
      {type === "none" ? (
        <div className="flex items-end">
          <p className="w-full rounded-xl border border-edge bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-faint">
            No deposit - clients book without paying anything upfront.
          </p>
          <input type="hidden" name={nameValue} value="0" />
        </div>
      ) : (
        <div>
          <Label>{type === "fixed" ? "Amount (£)" : "Percentage (%)"}</Label>
          <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-white/[0.04] px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
            {type === "fixed" && <span className="text-base font-semibold text-brand-300">£</span>}
            <input
              key={type}
              name={nameValue}
              type="text"
              inputMode="decimal"
              defaultValue={defaultValue}
              placeholder={type === "fixed" ? "15.00" : "30"}
              className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-ink-faint sm:text-sm"
            />
            {type === "percent" && <span className="text-base font-semibold text-brand-300">%</span>}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {type === "fixed"
              ? fixedHint ?? "Exact pounds, e.g. 15.00 = £15."
              : percentHint ?? "Share of the price, e.g. 30 = 30%. On a £50 service that's £15."}
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
): { type: AmountMode; display: string } {
  const t = type ?? "percent";
  if (t === "fixed") {
    const pennies = value ?? 0;
    return { type: "fixed", display: (pennies / 100).toFixed(2) };
  }
  if (t === "none") return { type: "none", display: "0" };
  return { type: "percent", display: String(value ?? fallbackPct) };
}
