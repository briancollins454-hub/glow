"use client";

import { useState } from "react";
import { Check, Ban } from "lucide-react";
import { setCategoryColourAction } from "@/app/dashboard/actions";
import {
  CATEGORY_PALETTE,
  blockTint,
  hexAlpha,
  paletteColour,
} from "@/lib/category-colours";
import type { ServiceCategory } from "@/lib/db/types";

/**
 * Palette swatches for one category, with a live preview of how a diary
 * block will look. Fixed palette only — no free-form colour input.
 */
export function CategoryColourPicker({ category }: { category: ServiceCategory }) {
  const [selected, setSelected] = useState<string>(paletteColour(category.colour)?.id ?? "");
  const chosen = paletteColour(selected);

  return (
    <form action={setCategoryColourAction} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="colour" value={selected} />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelected("")}
          aria-label="No colour"
          aria-pressed={selected === ""}
          title="No colour"
          className={`grid h-7 w-7 place-items-center rounded-full border text-ink-faint ${
            selected === "" ? "border-ink ring-2 ring-brand-400/50" : "border-edge"
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
        {CATEGORY_PALETTE.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
            aria-label={c.label}
            aria-pressed={selected === c.id}
            title={c.label}
            className={`grid h-7 w-7 place-items-center rounded-full border ${
              selected === c.id ? "border-ink ring-2 ring-brand-400/50" : "border-transparent"
            }`}
            style={{ backgroundColor: c.hex }}
          >
            {selected === c.id && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        ))}
      </div>

      {/* Live preview of a diary block in this colour. */}
      <div
        className="max-w-[16rem] rounded-lg border border-brand-400/50 bg-surface px-2 py-1.5 shadow-sm"
        style={
          chosen
            ? {
                backgroundColor: blockTint(chosen.hex),
                borderColor: hexAlpha(chosen.hex, 0.45),
                borderLeft: `3px solid ${chosen.hex}`,
              }
            : undefined
        }
      >
        <p className="truncate text-xs font-medium text-ink">10:00 · Sarah Jones</p>
        <p className="truncate text-[10px] text-ink-faint">{category.name} · Confirmed</p>
      </div>

      <button
        type="submit"
        className="rounded-lg border border-edge bg-fill px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-fill-hover"
      >
        Save colour
      </button>
    </form>
  );
}
