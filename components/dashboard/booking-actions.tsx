"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2, MoreHorizontal, Pencil } from "lucide-react";
import {
  approveBookingRequestDashboardAction,
  declineBookingRequestDashboardAction,
  setBookingStatusAction,
} from "@/app/dashboard/actions";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";
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

/** Only one booking menu open at a time across the list. */
let activeMenuId: string | null = null;
const menuListeners = new Set<(id: string | null) => void>();

function broadcastActiveMenu(id: string | null) {
  activeMenuId = id;
  for (const listener of menuListeners) listener(id);
}

function MenuSubmitButton({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/[0.06] disabled:opacity-60 ${
        danger ? "text-red-400" : "text-ink"
      }`}
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const options = transitions[status];
  const canCancel = status === "pending" || status === "confirmed";

  useEffect(() => {
    const onOtherOpen = (activeId: string | null) => {
      if (activeId !== menuId) setOpen(false);
    };
    menuListeners.add(onOtherOpen);
    return () => {
      menuListeners.delete(onOtherOpen);
    };
  }, [menuId]);

  useEffect(() => {
    if (!open) return;
    broadcastActiveMenu(menuId);

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (activeMenuId === menuId) broadcastActiveMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (activeMenuId === menuId) broadcastActiveMenu(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuId]);

  const toggle = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) broadcastActiveMenu(menuId);
      else if (activeMenuId === menuId) broadcastActiveMenu(null);
      return next;
    });
  };

  const onMutate = () => {
    // Bust client dashboard cache so the redirect shows the new status.
    clearDashboardCache();
  };

  return (
    <div ref={rootRef} className={`relative ${open ? "z-50" : ""}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-white/[0.07]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-surface-raised py-1 shadow-card ring-1 ring-black/50"
        >
          <Link
            href={`/dashboard/bookings/${id}`}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-white/[0.06]"
            onClick={() => setOpen(false)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit / reschedule
          </Link>
          {status === "pending_approval" && (
            <>
              <form action={approveBookingRequestDashboardAction} onSubmit={onMutate}>
                <input type="hidden" name="id" value={id} />
                <MenuSubmitButton>Approve request</MenuSubmitButton>
              </form>
              <form action={declineBookingRequestDashboardAction} onSubmit={onMutate}>
                <input type="hidden" name="id" value={id} />
                <MenuSubmitButton danger>Decline request</MenuSubmitButton>
              </form>
            </>
          )}
          {options.map((o) => (
            <form key={o.status} action={setBookingStatusAction} onSubmit={onMutate}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={o.status} />
              <MenuSubmitButton danger={o.danger}>{o.label}</MenuSubmitButton>
            </form>
          ))}
          {canCancel &&
            cancelOptions.map((o) => (
              <form key={o.cancelReason} action={setBookingStatusAction} onSubmit={onMutate}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value="cancelled" />
                <input type="hidden" name="cancelReason" value={o.cancelReason} />
                <MenuSubmitButton danger>{o.label}</MenuSubmitButton>
              </form>
            ))}
        </div>
      )}
    </div>
  );
}
