"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filterClients } from "@/lib/clients/search";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/db/types";

const MAX_RESULTS = 30;
const NEW_CLIENT_VALUE = "";

/**
 * Searchable client selector for forms (submits `name` with the client id,
 * empty string = new client). Type to filter by name, email or phone;
 * results list is capped so a 1,400-client salon stays usable on mobile.
 */
export function ClientPicker({
  clients,
  name,
  defaultValue = NEW_CLIENT_VALUE,
  id,
  className,
  onSelected,
}: {
  clients: Client[];
  name: string;
  defaultValue?: string;
  id?: string;
  className?: string;
  onSelected?: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Tapping/clicking outside closes the results list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const matches = useMemo(
    () => filterClients(clients, debounced).slice(0, MAX_RESULTS),
    [clients, debounced],
  );

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  function select(clientId: string) {
    setSelectedId(clientId);
    setOpen(false);
    onSelected?.(clientId);
  }

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <input type="hidden" name={name} value={selectedId} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          id={id}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, email or phone…"
          className="pl-9"
          aria-label="Search clients"
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-ink-faint">
        {selected ? (
          <>
            Selected:{" "}
            <span className="font-medium text-ink-soft">{selected.name || "Unnamed client"}</span>
          </>
        ) : (
          <>
            <span className="font-medium text-ink-soft">New client</span> - fill in their details
            below.
          </>
        )}
      </p>

      {open && (
        <div
          className="max-h-56 overflow-y-auto rounded-xl border border-edge bg-fill"
          role="listbox"
          aria-label="Clients"
        >
          <button
            type="button"
            role="option"
            aria-selected={selectedId === NEW_CLIENT_VALUE}
            onClick={() => select(NEW_CLIENT_VALUE)}
            className={cn(
              "flex w-full items-center gap-2.5 border-b border-edge px-3.5 py-2.5 text-left text-sm transition",
              selectedId === NEW_CLIENT_VALUE
                ? "bg-brand-500/15 text-ink"
                : "text-ink-soft hover:bg-fill-hover",
            )}
          >
            <UserPlus className="h-4 w-4 shrink-0 text-brand-text" />
            <span className="font-medium">New client</span>
            {selectedId === NEW_CLIENT_VALUE && (
              <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-brand-text" />
            )}
          </button>

          {matches.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-ink-faint">
              {clients.length === 0 ? "No clients yet." : "No clients match that search."}
            </p>
          ) : (
            <ul>
              {matches.map((c) => {
                const active = c.id === selectedId;
                const contact = [c.email, c.phone].filter(Boolean).join(" · ");
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => select(c.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition",
                        active ? "bg-brand-500/15 text-ink" : "text-ink-soft hover:bg-fill-hover",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {c.name || "Unnamed client"}
                        </span>
                        {contact && (
                          <span className="block truncate text-xs text-ink-faint">{contact}</span>
                        )}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-text" />}
                    </button>
                  </li>
                );
              })}
              {filterClients(clients, debounced).length > MAX_RESULTS && (
                <li className="px-3.5 py-2 text-xs text-ink-faint">
                  Keep typing to narrow the list…
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
