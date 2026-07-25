"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

const PANEL_MAX_HEIGHT = 320;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Searchable scope picker for consultation questions.
 * Dropdown renders in a portal so it never sits under the next card.
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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => setMounted(true), []);

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN - PANEL_GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - PANEL_GAP;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, Math.max(160, openUp ? spaceAbove : spaceBelow));
    const top = openUp
      ? Math.max(VIEWPORT_MARGIN, rect.top - PANEL_GAP - maxHeight)
      : rect.bottom + PANEL_GAP;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      window.innerWidth - rect.width - VIEWPORT_MARGIN,
    );
    setCoords({
      top,
      left,
      width: rect.width,
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
    const onReposition = () => placePanel();
    window.addEventListener("resize", onReposition);
    // Capture scroll from any scrollable ancestor (dashboard layout).
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
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
    triggerRef.current?.focus();
  }

  const panel =
    open && mounted && coords
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className="fixed z-[220] flex flex-col overflow-hidden rounded-xl border border-edge bg-surface shadow-card ring-1 ring-black/10"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-edge bg-surface px-3 py-2">
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface py-1">
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
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
      {panel}
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
