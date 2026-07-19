"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceSortableList } from "@/components/dashboard/service-sortable-list";
import { deleteServicesAction } from "@/app/dashboard/actions";
import type { Service, ServiceCategory } from "@/lib/db/types";

export function ServicesBulkDelete({
  services,
  categories,
  renderService,
}: {
  services: Service[];
  categories: ServiceCategory[];
  renderService: (service: Service) => React.ReactNode;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <ServiceSortableList
        services={services}
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
  );
}
