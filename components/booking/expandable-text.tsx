"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Truncated copy with a Read more / Show less control for long service blurbs. */
export function ExpandableText({
  text,
  className,
  clampClass = "line-clamp-2",
  moreLabel = "Read more",
  lessLabel = "Show less",
}: {
  text: string;
  className?: string;
  /** Tailwind clamp class used while collapsed. */
  clampClass?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Short blurbs never need a toggle; ~120 chars fits ~2 lines on mobile cards.
  const needsToggle = text.trim().length > 120;

  return (
    <div className={cn(className)}>
      <p className={cn("text-sm leading-relaxed text-ink-soft", !open && needsToggle && clampClass)}>
        {text}
      </p>
      {needsToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="mt-1 text-sm font-medium text-brand-300 underline-offset-2 hover:underline"
        >
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}
