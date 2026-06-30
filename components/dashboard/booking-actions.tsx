import { MoreHorizontal } from "lucide-react";
import { setBookingStatusAction } from "@/app/dashboard/actions";
import type { BookingStatus } from "@/lib/db/types";

const transitions: Record<BookingStatus, { status: BookingStatus; label: string; danger?: boolean }[]> = {
  pending: [
    { status: "confirmed", label: "Confirm" },
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show", danger: true },
    { status: "cancelled", label: "Cancel", danger: true },
  ],
  confirmed: [
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show", danger: true },
    { status: "cancelled", label: "Cancel", danger: true },
  ],
  completed: [{ status: "confirmed", label: "Reopen" }],
  cancelled: [{ status: "confirmed", label: "Reinstate" }],
  no_show: [{ status: "completed", label: "Mark completed" }],
};

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const options = transitions[status];
  if (!options.length) return null;
  return (
    <details className="relative">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg text-ink-soft hover:bg-black/[0.05]">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-soft">
        {options.map((o) => (
          <form key={o.status} action={setBookingStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={o.status} />
            <button
              type="submit"
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-black/[0.04] ${
                o.danger ? "text-red-600" : "text-ink"
              }`}
            >
              {o.label}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
