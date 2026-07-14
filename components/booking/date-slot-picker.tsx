"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { fmtTime, TZ } from "@/lib/format";
import { onBrand } from "@/lib/booking/brand";

type DayOption = { dateStr: string; slots: string[] };

export function DateSlotPicker({
  days,
  initialDate,
  initialSlot,
  brand,
  onSlotChange,
}: {
  days: DayOption[];
  initialDate?: string;
  initialSlot?: string;
  brand: string;
  onSlotChange?: (slot: string) => void;
}) {
  const defaultDate =
    initialDate && days.some((d) => d.dateStr === initialDate)
      ? initialDate
      : days[0]?.dateStr ?? "";

  const [activeDate, setActiveDate] = useState(defaultDate);
  const [slot, setSlot] = useState(() => {
    if (initialSlot && days.some((d) => d.slots.includes(initialSlot))) {
      return initialSlot;
    }
    const day = days.find((d) => d.dateStr === defaultDate);
    return day?.slots[0] ?? "";
  });

  const slots = useMemo(
    () => days.find((d) => d.dateStr === activeDate)?.slots ?? [],
    [days, activeDate],
  );

  useEffect(() => {
    onSlotChange?.(slot);
  }, [onSlotChange, slot]);

  const pickDate = (dateStr: string) => {
    setActiveDate(dateStr);
    const day = days.find((d) => d.dateStr === dateStr);
    const next = day?.slots[0] ?? "";
    setSlot(next);
    onSlotChange?.(next);
  };

  const pickSlot = (s: string) => {
    setSlot(s);
    onSlotChange?.(s);
  };

  if (days.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const isActive = d.dateStr === activeDate;
          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => pickDate(d.dateStr)}
              className="flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-center text-sm transition"
              style={
                isActive
                  ? { backgroundColor: brand, borderColor: brand, color: onBrand(brand) }
                  : { borderColor: "rgba(255,255,255,0.14)" }
              }
            >
              <span className="text-xs opacity-80">
                {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "EEE")}
              </span>
              <span className="text-lg font-semibold">
                {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "d")}
              </span>
              <span className="text-[10px] opacity-80">
                {formatInTimeZone(new Date(`${d.dateStr}T12:00:00Z`), TZ, "MMM")}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 font-semibold">Pick a time</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((s) => {
          const isActive = s === slot;
          return (
            <button
              key={s}
              type="button"
              onClick={() => pickSlot(s)}
              className="rounded-xl border py-2.5 text-center text-sm font-medium transition"
              style={
                isActive
                  ? { backgroundColor: brand, borderColor: brand, color: onBrand(brand) }
                  : { borderColor: "rgba(255,255,255,0.14)" }
              }
            >
              {fmtTime(s)}
            </button>
          );
        })}
      </div>
    </>
  );
}
