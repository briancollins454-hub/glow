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
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildQuestionScopeOptions,
  filterQuestionScopeOptions,
  packScopeLabel,
  type QuestionScopeOption,
} from "@/lib/booking/consultation-scope";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; active?: boolean; categoryId?: string };

const PANEL_MAX_HEIGHT = 360;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Multi-select "Shown for" control for a consultation form pack.
 * Empty selection = all services. Categories and/or many services can be ticked.
 */
export function PackScopePicker({
  name = "target",
  categories,
  services,
  defaultSelected = [],
}: {
  name?: string;
  categories: Item[];
  services: Item[];
  /** Values like category:id / service:id. Empty = all services. */
  defaultSelected?: string[];
}) {
  const options = useMemo(
    () => buildQuestionScopeOptions(categories, services),
    [categories, services],
  );
  const [selected, setSelected] = useState<string[]>(() =>
    defaultSelected.filter((v) => v && v !== "all"),
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const filtered = useMemo(
    () => filterQuestionScopeOptions(options, query).filter((o) => o.kind !== "all"),
    [options, query],
  );
  const categoriesFiltered = filtered.filter((o) => o.kind === "category");
  const servicesFiltered = filtered.filter((o) => o.kind === "service");
  const isAll = selected.length === 0;

  const summary = useMemo(() => {
    if (isAll) return "All services";
    const targets = selected.map((value) => {
      if (value.startsWith("service:")) {
        return { categoryId: null, serviceId: value.slice("service:".length) };
      }
      return { categoryId: value.slice("category:".length), serviceId: null };
    });
    return packScopeLabel(targets, {
      categoryName: (id) => categories.find((c) => c.id === id)?.name,
      serviceName: (id) => services.find((s) => s.id === id)?.name,
    });
  }, [isAll, selected, categories, services]);

  useEffect(() => setMounted(true), []);

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN - PANEL_GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - PANEL_GAP;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, Math.max(200, openUp ? spaceAbove : spaceBelow));
    const top = openUp
      ? Math.max(VIEWPORT_MARGIN, rect.top - PANEL_GAP - maxHeight)
      : rect.bottom + PANEL_GAP;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN),
    );
    setCoords({
      top,
      left,
      width: Math.max(rect.width, Math.min(440, window.innerWidth - VIEWPORT_MARGIN * 2)),
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
    const onReposition = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      placePanel();
    };
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", placePanel);
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
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(option: QuestionScopeOption) {
    setSelected((prev) => {
      if (prev.includes(option.value)) return prev.filter((v) => v !== option.value);
      return [...prev, option.value];
    });
  }

  function selectAllInCategory(categoryId: string) {
    const serviceValues = options
      .filter((o) => o.kind === "service" && o.categoryId === categoryId)
      .map((o) => o.value);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(`category:${categoryId}`);
      for (const v of serviceValues) next.add(v);
      return [...next];
    });
  }

  function clearToAll() {
    setSelected([]);
  }

  const panel =
    open && mounted && coords
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
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

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-surface py-1 [-webkit-overflow-scrolling:touch]">
              <button
                type="button"
                role="option"
                aria-selected={isAll}
                className={cn(
                  "flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm",
                  isAll ? "bg-brand-soft/60 text-ink" : "text-ink hover:bg-fill",
                )}
                onClick={clearToAll}
              >
                <span className="font-medium">All services</span>
                {isAll && <Check className="h-4 w-4 shrink-0 text-brand-400" />}
              </button>

              {categoriesFiltered.length > 0 && (
                <ScopeGroup label="Categories — tick one or many">
                  {categoriesFiltered.map((option) => {
                    const categoryId = option.value.slice("category:".length);
                    const checked = selected.includes(option.value);
                    return (
                      <div key={option.value} className="flex items-stretch gap-1 pr-2">
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          className={cn(
                            "flex min-h-11 flex-1 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm",
                            checked ? "bg-brand-soft/60 text-ink" : "text-ink hover:bg-fill",
                          )}
                          onClick={() => toggle(option)}
                        >
                          <span className="truncate font-medium">{option.label}</span>
                          {checked && <Check className="h-4 w-4 shrink-0 text-brand-400" />}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 px-2 text-[11px] font-medium text-brand-400 hover:underline"
                          onClick={() => selectAllInCategory(categoryId)}
                          title="Also select every service in this category"
                        >
                          + services
                        </button>
                      </div>
                    );
                  })}
                </ScopeGroup>
              )}

              {servicesFiltered.length > 0 && (
                <ScopeGroup label={`Services (${servicesFiltered.length})`}>
                  {servicesFiltered.map((option) => {
                    const checked = selected.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        className={cn(
                          "flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm",
                          checked ? "bg-brand-soft/60 text-ink" : "text-ink hover:bg-fill",
                        )}
                        onClick={() => toggle(option)}
                      >
                        <span className="truncate font-medium">{option.label}</span>
                        {checked && <Check className="h-4 w-4 shrink-0 text-brand-400" />}
                      </button>
                    );
                  })}
                </ScopeGroup>
              )}

              {categoriesFiltered.length === 0 && servicesFiltered.length === 0 && query.trim() && (
                <p className="px-4 py-3 text-sm text-ink-faint">No matches.</p>
              )}
            </div>

            <div className="shrink-0 border-t border-edge bg-surface px-3 py-2 text-xs text-ink-faint">
              Tip: for all piercings, tick the Piercings category once — new piercing services inherit it.
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full">
      {isAll ? (
        <input type="hidden" name={name} value="all" />
      ) : (
        selected.map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))
      )}
      <button
        ref={triggerRef}
        type="button"
        className="input flex w-full min-h-11 items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone="neutral" className="max-w-full truncate text-sm">
            {summary}
          </Badge>
          {!isAll && (
            <span className="text-xs text-ink-faint">{selected.length} selected</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition", open && "rotate-180")}
        />
      </button>
      {!isAll && (
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
          onClick={clearToAll}
        >
          <X className="h-3 w-3" /> Reset to all services
        </button>
      )}
      {panel}
    </div>
  );
}

function ScopeGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pt-1">
      <p className="sticky top-0 z-10 bg-surface px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      {children}
    </div>
  );
}
