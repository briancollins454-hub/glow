"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  DAY_VIEW_ZOOM_LABELS,
  DAY_VIEW_ZOOM_LEVELS,
  DEFAULT_DAY_VIEW_ZOOM,
  cycleDayViewZoom,
  normalizeDayViewZoom,
  pxPerMinForZoom,
  readStoredDayViewZoom,
  writeStoredDayViewZoom,
  type DayViewZoom,
} from "@/lib/booking/day-block-layout";
import { cn } from "@/lib/utils";

/**
 * Persistable day-view zoom. localStorage matches other dashboard UI prefs
 * (theme); no server column — density is a per-device diary preference.
 */
export function useDayViewZoom(): {
  zoom: DayViewZoom;
  setZoom: (zoom: DayViewZoom) => void;
  pxPerMin: number;
} {
  const [zoom, setZoomState] = useState<DayViewZoom>(DEFAULT_DAY_VIEW_ZOOM);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredDayViewZoom();
    if (stored) setZoomState(stored);
    setHydrated(true);
  }, []);

  function setZoom(next: DayViewZoom) {
    const value = normalizeDayViewZoom(next);
    setZoomState(value);
    writeStoredDayViewZoom(value);
  }

  return {
    zoom: hydrated ? zoom : DEFAULT_DAY_VIEW_ZOOM,
    setZoom,
    pxPerMin: pxPerMinForZoom(hydrated ? zoom : DEFAULT_DAY_VIEW_ZOOM),
  };
}

/** Segmented zoom control for the day-view toolbar. */
export function DayViewZoomControl({
  zoom,
  onChange,
  className,
}: {
  zoom: DayViewZoom;
  onChange: (zoom: DayViewZoom) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label="Calendar zoom"
    >
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom === "compact"}
        onClick={() => onChange(cycleDayViewZoom(zoom, -1))}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="flex rounded-lg border border-edge p-0.5">
        {DAY_VIEW_ZOOM_LEVELS.map((level) => {
          const selected = level === zoom;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={selected}
              aria-label={`${DAY_VIEW_ZOOM_LABELS[level]} calendar zoom`}
              onClick={() => onChange(level)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                selected
                  ? "bg-brand-500/20 text-brand-text"
                  : "text-ink-soft hover:bg-fill-hover hover:text-ink",
              )}
            >
              {DAY_VIEW_ZOOM_LABELS[level]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom === "spacious"}
        onClick={() => onChange(cycleDayViewZoom(zoom, 1))}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
