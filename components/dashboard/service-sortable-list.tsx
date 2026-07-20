"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Service } from "@/lib/db/types";
import { reorderServicesAction } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

function SortableServiceRow({
  id,
  disableDrag,
  selected,
  onToggleSelect,
  children,
}: {
  id: string;
  disableDrag?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: disableDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-stretch gap-2", isDragging && "z-10 opacity-90")}
    >
      {onToggleSelect ? (
        <label className="mt-3 flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-edge">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
            aria-label="Select service"
          />
        </label>
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-3 flex h-11 w-10 shrink-0 touch-none cursor-grab flex-col items-center justify-center rounded-xl border border-edge text-ink-faint transition hover:bg-fill-hover active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ServiceSortableList({
  services,
  renderService,
  disableDrag,
  selection,
}: {
  services: Service[];
  renderService: (service: Service) => React.ReactNode;
  disableDrag?: boolean;
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
  };
}) {
  const [items, setItems] = useState(services);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(services);
  }, [services]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    if (disableDrag) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);

    startTransition(async () => {
      const result = await reorderServicesAction(next.map((s) => s.id));
      if (!result.ok) {
        setItems(services);
        setError("Could not save order. Try again.");
      }
    });
  };

  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">No services yet.</p>;
  }

  return (
    <div className="space-y-3">
      {!disableDrag && (
        <p className="text-xs text-ink-faint">
          Drag the handle to reorder. On phone, press and hold the handle, then move.
          {pending ? " Saving…" : ""}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {items.map((service) => (
            <SortableServiceRow
              key={service.id}
              id={service.id}
              disableDrag={disableDrag}
              selected={selection?.selectedIds.has(service.id)}
              onToggleSelect={selection ? () => selection.onToggle(service.id) : undefined}
            >
              {renderService(service)}
            </SortableServiceRow>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
