"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/input";
import type { DepositType } from "@/lib/db/types";

/**
 * Deposit type + amount, where the amount box visibly transforms as the type
 * changes: £ prefix for a set amount, % suffix for a percentage, and it
 * disappears entirely for "no deposit" - so the switch is unmistakable.
 */
export function DepositFields({
  defaultType,
  defaultValue,
}: {
  defaultType: DepositType;
  defaultValue: string;
}) {
  const [type, setType] = useState<DepositType>(defaultType);

  return (
    <>
      <div>
        <Label>Deposit</Label>
        <Select
          name="depositType"
          value={type}
          onChange={(e) => setType(e.target.value as DepositType)}
        >
          <option value="fixed">Set amount (£)</option>
          <option value="percent">Percentage of price (%)</option>
          <option value="none">No deposit</option>
        </Select>
      </div>
      {type === "none" ? (
        <div className="flex items-end">
          <p className="w-full rounded-xl border border-edge bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-faint">
            No deposit - clients book without paying anything upfront.
          </p>
          {/* Keep the field posted so the form shape stays the same. */}
          <input type="hidden" name="depositValue" value="0" />
        </div>
      ) : (
        <div>
          <Label>{type === "fixed" ? "Deposit amount (£)" : "Deposit percentage (%)"}</Label>
          <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-white/[0.04] px-3.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30">
            {type === "fixed" && <span className="text-base font-semibold text-brand-300">£</span>}
            <input
              key={type}
              name="depositValue"
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
              ? "The exact amount clients pay upfront, e.g. 15.00 = £15."
              : "A share of the price, e.g. 30 = 30%. On a £50 service that's £15 upfront."}
          </p>
        </div>
      )}
    </>
  );
}
