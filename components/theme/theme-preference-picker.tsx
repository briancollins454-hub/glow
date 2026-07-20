"use client";

import { useState } from "react";
import { Label } from "@/components/ui/input";
import { setDashboardThemePreference } from "@/components/theme/theme-sync";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Match your device" },
  { value: "dark", label: "Dark", hint: "Always dark" },
  { value: "light", label: "Light", hint: "Always light" },
];

export function ThemePreferencePicker({
  name,
  label,
  description,
  defaultValue = "system",
  applyLive = false,
}: {
  name: string;
  label: string;
  description: string;
  defaultValue?: ThemePreference;
  /** When true, changing the choice updates the page immediately (dashboard). */
  applyLive?: boolean;
}) {
  const [value, setValue] = useState<ThemePreference>(defaultValue);

  return (
    <div className="sm:col-span-2">
      <Label>{label}</Label>
      <p className="mb-2 text-xs text-ink-faint">{description}</p>
      <input type="hidden" name={name} value={value} />
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setValue(opt.value);
                if (applyLive) setDashboardThemePreference(opt.value);
              }}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-brand-500/50 bg-brand-soft text-ink"
                  : "border-edge bg-fill text-ink-soft hover:bg-fill-hover",
              )}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
