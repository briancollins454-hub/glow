"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceSortableList } from "@/components/dashboard/service-sortable-list";
import { deleteServicesAction } from "@/app/dashboard/actions";
import { groupServicesForDashboard } from "@/lib/booking/service-groups";
import type { Service, ServiceCategory } from "@/lib/db/types";

export function ServicesBulkDelete({
  services,
  categories,
  renderService,
  openServiceId,
}: {
  services: Service[];
  categories: ServiceCategory[];
  renderService: (service: Service) => React.ReactNode;
  /** When set, the category containing this service opens by default. */
  openServiceId?: string | null;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () => groupServicesForDashboard(categories, services),
    [categories, services],
  );

  const openGroupId = useMemo(() => {
    if (!openServiceId) return groups.length === 1 ? groups[0]?.id ?? null : null;
    return groups.find((g) => g.services.some((s) => s.id === openServiceId))?.id ?? null;
  }, [groups, openServiceId]);

  const catOptions = useMemo(
    () =>
      categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          count: services.filter((s) => s.categoryId === c.id).length,
        }))
        .filter((c) => c.count > 0),
    [categories, services],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(services.map((s) => s.id)));
  }

  function selectCategory(categoryId: string) {
    setSelected(new Set(services.filter((s) => s.categoryId === categoryId).map((s) => s.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function exitSelectMode() {
    setSelecting(false);
    setSelected(new Set());
    setMessage(null);
    setError(null);
  }

  function deleteSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = window.confirm(
      `Delete ${ids.length} service${ids.length === 1 ? "" : "s"}?\n\nThis also removes appointments linked to those services. This cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await deleteServicesAction(ids);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      setMessage(`Deleted ${res.deleted} service${res.deleted === 1 ? "" : "s"}.`);
      setSelecting(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!selecting ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setSelecting(true)}>
            <Trash2 className="h-4 w-4" /> Select to delete
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={selectAll}>
              Select all ({services.length})
            </Button>
            <select
              className="input h-9 max-w-[14rem] text-sm"
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) selectCategory(e.target.value);
                e.target.value = "";
              }}
              aria-label="Select all in a category"
            >
              <option value="">Select a category…</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={clearSelection}>
              Clear
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || selected.size === 0}
              className="text-red-300 hover:bg-red-500/10"
              onClick={deleteSelected}
            >
              <Trash2 className="h-4 w-4" />
              {pending ? "Deleting…" : `Delete selected (${selected.size})`}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={exitSelectMode}>
              Done
            </Button>
          </>
        )}
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {selecting && (
        <p className="text-xs text-ink-faint">
          Tick services to delete. Linked appointments are removed with them.
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-ink-faint">No services yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <details
              key={group.id}
              className="rounded-xl border border-edge bg-white/[0.02]"
              open={openGroupId === group.id || groups.length === 1}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-ink">
                  {group.title}{" "}
                  <span className="font-normal text-ink-faint">({group.services.length})</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
              </summary>
              <div className="border-t border-edge px-3 py-3">
                <ServiceSortableList
                  services={group.services}
                  disableDrag={selecting}
                  renderService={renderService}
                  selection={
                    selecting
                      ? {
                          selectedIds: selected,
                          onToggle: toggle,
                        }
                      : undefined
                  }
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
