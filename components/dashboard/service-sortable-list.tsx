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
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="mt-3 flex h-11 w-10 shrink-0 touch-none cursor-grab flex-col items-center justify-center rounded-xl border border-edge text-ink-faint transition hover:bg-white/[0.06] active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ServiceSortableList({
  services,
  renderService,
}: {
  services: Service[];
  renderService: (service: Service) => React.ReactNode;
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
      <p className="text-xs text-ink-faint">
        Drag the handle to reorder. On phone, press and hold the handle, then move.
        {pending ? " Saving…" : ""}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {items.map((service) => (
            <SortableServiceRow key={service.id} id={service.id}>
              {renderService(service)}
            </SortableServiceRow>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
