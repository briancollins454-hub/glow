"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { legendEntries } from "@/lib/category-colours";
import type { ServiceCategory } from "@/lib/db/types";

/**
 * Collapsible category-colour legend for the diary. Renders nothing until at
 * least one category has a colour. Open/closed state is remembered per tech
 * on this device.
 */
export function DiaryColourLegend({
  categories,
  techId,
}: {
  categories: Pick<ServiceCategory, "id" | "name" | "colour">[];
  techId: string;
}) {
  const entries = legendEntries(categories);
  const storageKey = `glow-diary-legend-${techId}`;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) === "open");
    } catch {
      // Private browsing — default closed.
    }
    setReady(true);
  }, [storageKey]);

  if (entries.length === 0) return null;

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {
      // Best-effort persistence only.
    }
  };

  return (
    <div className="rounded-xl border border-edge bg-cream px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => toggle(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-ink-soft"
      >
        <span className="flex items-center gap-2">
          <span className="flex -space-x-1">
            {entries.slice(0, 4).map((e) => (
              <span
                key={e.id}
                className="inline-block h-3 w-3 rounded-full ring-1 ring-surface"
                style={{ backgroundColor: e.hex }}
              />
            ))}
          </span>
          Colour legend
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-faint transition-transform ${open && ready ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {entries.map((e) => (
            <span key={e.id} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: e.hex }}
              />
              {e.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
