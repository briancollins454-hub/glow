"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildQuestionScopeOptions,
  filterQuestionScopeOptions,
  questionScopeSelectionLabel,
  type QuestionScopeOption,
} from "@/lib/booking/consultation-scope";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; active?: boolean };

/**
 * Searchable scope picker for consultation questions.
 * Replaces a native <select> that becomes unusable with 100+ services.
 */
export function QuestionScopePicker({
  name = "scope",
  categories,
  services,
  defaultValue = "all",
}: {
  name?: string;
  categories: Item[];
  services: Item[];
  defaultValue?: string;
}) {
  const options = useMemo(
    () => buildQuestionScopeOptions(categories, services),
    [categories, services],
  );
  const [value, setValue] = useState(
    options.some((o) => o.value === defaultValue) ? defaultValue : "all",
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const filtered = useMemo(
    () => filterQuestionScopeOptions(options, query),
    [options, query],
  );
  const categoriesFiltered = filtered.filter((o) => o.kind === "category");
  const servicesFiltered = filtered.filter((o) => o.kind === "service");
  const allOption = filtered.find((o) => o.kind === "all");
  const selectedLabel = questionScopeSelectionLabel(value, options);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    // Focus filter as soon as the panel opens (mobile-friendly).
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(option: QuestionScopeOption) {
    setValue(option.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className="input flex w-full min-h-11 items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <Badge tone="neutral" className="max-w-full truncate text-sm">
          {selectedLabel}
        </Badge>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-edge bg-surface shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories or services…"
              className="w-full bg-transparent py-2 text-base outline-none placeholder:text-ink-faint"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {allOption && (
              <ScopeOptionRow
                option={allOption}
                selected={value === allOption.value}
                onSelect={pick}
              />
            )}

            {categoriesFiltered.length > 0 && (
              <ScopeGroup label="Categories">
                {categoriesFiltered.map((option) => (
                  <ScopeOptionRow
                    key={option.value}
                    option={option}
                    selected={value === option.value}
                    onSelect={pick}
                  />
                ))}
              </ScopeGroup>
            )}

            {servicesFiltered.length > 0 && (
              <ScopeGroup label="Services">
                {servicesFiltered.map((option) => (
                  <ScopeOptionRow
                    key={option.value}
                    option={option}
                    selected={value === option.value}
                    onSelect={pick}
                  />
                ))}
              </ScopeGroup>
            )}

            {!allOption && categoriesFiltered.length === 0 && servicesFiltered.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink-faint">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pt-1">
      <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      {children}
    </div>
  );
}

function ScopeOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: QuestionScopeOption;
  selected: boolean;
  onSelect: (option: QuestionScopeOption) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        "flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition",
        selected ? "bg-brand-soft/60 text-ink" : "text-ink hover:bg-fill",
      )}
      onClick={() => onSelect(option)}
    >
      <span className="truncate font-medium">{option.label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-brand-400" />}
    </button>
  );
}
