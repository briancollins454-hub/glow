"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CategorySection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count: number;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-edge bg-surface/80"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`category-panel-${id}`}
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-fill sm:px-5"
      >
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h3>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
            {count} service{count !== 1 ? "s" : ""}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={`category-panel-${id}`}
        role="region"
        hidden={!open}
        className={cn(!open && "hidden")}
      >
        <div className="border-t border-edge px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </div>
    </section>
  );
}
