"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { groupServicesForDashboard } from "@/lib/booking/service-groups";
import { gbp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service, ServiceCategory } from "@/lib/db/types";

export function ServicePicker({
  services,
  categories,
  name,
  defaultValue = "",
  required = false,
  id,
  value: controlledValue,
  onValueChange,
  className,
}: {
  services: Service[];
  categories: ServiceCategory[];
  name: string;
  defaultValue?: string;
  required?: boolean;
  id?: string;
  /** Controlled value. When set, pair with onValueChange. */
  value?: string;
  onValueChange?: (serviceId: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selectedId = controlledValue !== undefined ? controlledValue : uncontrolled;

  const groups = useMemo(
    () => groupServicesForDashboard(categories, services),
    [categories, services],
  );

  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        services: g.services.filter((s) => s.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.services.length > 0);
  }, [groups, q]);

  const selected = services.find((s) => s.id === selectedId) ?? null;
  const searchId = id ? `${id}-search` : undefined;

  function select(serviceId: string) {
    if (controlledValue === undefined) setUncontrolled(serviceId);
    onValueChange?.(serviceId);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Not type=hidden: browsers skip constraint validation on those. */}
      <input
        type="text"
        name={name}
        id={id}
        value={selectedId}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden={true}
        className="sr-only"
        onChange={() => {}}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services…"
          className="pl-9"
          aria-label="Search services"
          autoComplete="off"
        />
      </div>

      {selected && (
        <p className="text-xs text-ink-faint">
          Selected: <span className="font-medium text-ink-soft">{selected.name}</span>
          {" · "}
          {gbp(selected.pricePennies)}
        </p>
      )}
      {!selected && required && (
        <p className="text-xs text-ink-faint">Choose a service below.</p>
      )}

      <div
        className="max-h-56 overflow-y-auto rounded-xl border border-edge bg-white/[0.03]"
        role="listbox"
        aria-label="Services"
      >
        {filteredGroups.length === 0 ? (
          <p className="px-3.5 py-3 text-sm text-ink-faint">
            {services.length === 0 ? "No services yet." : "No services match that search."}
          </p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id}>
              <div className="sticky top-0 border-b border-edge/60 bg-[#141019]/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint backdrop-blur-sm">
                {group.title}
              </div>
              <ul>
                {group.services.map((s) => {
                  const active = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => select(s.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition",
                          active
                            ? "bg-brand-500/15 text-ink"
                            : "text-ink-soft hover:bg-white/[0.06]",
                        )}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {s.name}
                          {!s.active && (
                            <span className="ml-1.5 text-xs font-normal text-ink-faint">(inactive)</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                          {gbp(s.pricePennies)}
                          {active && <Check className="h-3.5 w-3.5 text-brand-300" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
