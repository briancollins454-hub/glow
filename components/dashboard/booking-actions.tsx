import Link from "next/link";
import { MoreHorizontal, Pencil } from "lucide-react";
import {
  approveBookingRequestDashboardAction,
  declineBookingRequestDashboardAction,
  setBookingStatusAction,
} from "@/app/dashboard/actions";
import type { BookingStatus } from "@/lib/db/types";

const transitions: Record<BookingStatus, { status: BookingStatus; label: string; danger?: boolean }[]> = {
  pending_approval: [],
  pending: [
    { status: "confirmed", label: "Confirm" },
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show", danger: true },
  ],
  confirmed: [
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show", danger: true },
  ],
  completed: [{ status: "confirmed", label: "Reopen" }],
  cancelled: [{ status: "confirmed", label: "Reinstate" }],
  no_show: [{ status: "completed", label: "Mark completed" }],
};

const cancelOptions = [
  {
    cancelReason: "client_late_cancel",
    label: "Client cancelled late, keep deposit",
  },
  {
    cancelReason: "tech_cancelled",
    label: "I'm cancelling, refund the client",
  },
] as const;

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const options = transitions[status];
  const canCancel = status === "pending" || status === "confirmed";
  return (
    // Elevate the open menu above sibling booking rows so items stay clickable
    // (absolute menus otherwise sit under the next card for hit-testing).
    <details className="relative [&[open]]:z-50">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg text-ink-soft hover:bg-white/[0.07]">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-edge bg-surface-raised py-1 shadow-card ring-1 ring-black/40">
        <Link
          href={`/dashboard/bookings/${id}`}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-white/[0.06]"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit / reschedule
        </Link>
        {status === "pending_approval" && (
          <>
            <form action={approveBookingRequestDashboardAction}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-white/[0.06]"
              >
                Approve request
              </button>
            </form>
            <form action={declineBookingRequestDashboardAction}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/[0.06]"
              >
                Decline request
              </button>
            </form>
          </>
        )}
        {options.map((o) => (
          <form key={o.status} action={setBookingStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={o.status} />
            <button
              type="submit"
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-white/[0.06] ${
                o.danger ? "text-red-400" : "text-ink"
              }`}
            >
              {o.label}
            </button>
          </form>
        ))}
        {canCancel &&
          cancelOptions.map((o) => (
            <form key={o.cancelReason} action={setBookingStatusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="cancelReason" value={o.cancelReason} />
              <button
                type="submit"
                className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/[0.06]"
              >
                {o.label}
              </button>
            </form>
          ))}
      </div>
    </details>
  );
}
