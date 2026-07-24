"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2, MoreHorizontal, Pencil, X } from "lucide-react";
import {
  approveBookingRequestDashboardAction,
  declineBookingRequestDashboardAction,
  setBookingStatusAction,
} from "@/app/dashboard/actions";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";
import {
  BOOKING_MENU_WIDTH,
  bookingMenuUsesBottomSheet,
  positionBookingMenu,
  type MenuCoords,
} from "@/lib/booking/menu-position";
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
    // Deposit mode keeps the deposit; card-capture mode charges the saved card.
    label: "Client cancelled late",
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
  large,
}: {
  children: React.ReactNode;
  danger?: boolean;
  large?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center gap-2 text-left hover:bg-fill-hover disabled:opacity-60 ${
        large ? "px-4 py-3.5 text-base" : "px-4 py-2 text-sm"
      } ${danger ? "text-red-400" : "text-ink"}`}
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

function MenuItems({
  id,
  status,
  options,
  canCancel,
  large,
  onClose,
  onMutate,
}: {
  id: string;
  status: BookingStatus;
  options: { status: BookingStatus; label: string; danger?: boolean }[];
  canCancel: boolean;
  large?: boolean;
  onClose: () => void;
  onMutate: () => void;
}) {
  const itemClass = large
    ? "flex w-full items-center gap-2 px-4 py-3.5 text-left text-base text-ink hover:bg-fill-hover"
    : "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-fill-hover";
  return (
    <>
      <Link
        href={`/dashboard/bookings/${id}`}
        role="menuitem"
        className={itemClass}
        onClick={onClose}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit / reschedule
      </Link>
      {status === "pending_approval" && (
        <>
          <form action={approveBookingRequestDashboardAction} onSubmit={onMutate}>
            <input type="hidden" name="id" value={id} />
            <MenuSubmitButton large={large}>Approve request</MenuSubmitButton>
          </form>
          <form action={declineBookingRequestDashboardAction} onSubmit={onMutate}>
            <input type="hidden" name="id" value={id} />
            <MenuSubmitButton large={large} danger>
              Decline request
            </MenuSubmitButton>
          </form>
        </>
      )}
      {options.map((o) => (
        <form key={o.status} action={setBookingStatusAction} onSubmit={onMutate}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={o.status} />
          <MenuSubmitButton large={large} danger={o.danger}>
            {o.label}
          </MenuSubmitButton>
        </form>
      ))}
      {canCancel &&
        cancelOptions.map((o) => (
          <form key={o.cancelReason} action={setBookingStatusAction} onSubmit={onMutate}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="cancelled" />
            <input type="hidden" name="cancelReason" value={o.cancelReason} />
            <MenuSubmitButton large={large} danger>
              {o.label}
            </MenuSubmitButton>
          </form>
        ))}
    </>
  );
}

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const options = transitions[status];
  const canCancel = status === "pending" || status === "confirmed";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onOtherOpen = (activeId: string | null) => {
      if (activeId !== menuId) setOpen(false);
    };
    menuListeners.add(onOtherOpen);
    return () => {
      menuListeners.delete(onOtherOpen);
    };
  }, [menuId]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setCoords(null);
    if (activeMenuId === menuId) broadcastActiveMenu(null);
    if (returnFocus) {
      // Defer so portal teardown doesn't steal focus.
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const useSheet = bookingMenuUsesBottomSheet(vw);
      setSheet(useSheet);
      if (useSheet) {
        setCoords(null);
        return;
      }
      const trigger = triggerRef.current!.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 280;
      setCoords(
        positionBookingMenu({
          trigger,
          menuHeight,
          menuWidth: BOOKING_MENU_WIDTH,
          viewportWidth: vw,
          viewportHeight: vh,
        }),
      );
    };

    place();
    // Re-measure after paint once menu content is in the DOM.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    broadcastActiveMenu(menuId);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close reads latest refs
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
    clearDashboardCache();
  };

  const menu =
    open && mounted
      ? createPortal(
          sheet ? (
            <div className="fixed inset-0 z-[200] sm:hidden" data-booking-menu-sheet>
              <button
                type="button"
                aria-label="Close menu"
                className="absolute inset-0 bg-black/50"
                onClick={() => close()}
              />
              <div
                ref={menuRef}
                role="menu"
                aria-label="Booking actions"
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-edge bg-surface-raised pb-safe shadow-card ring-1 ring-black/40"
              >
                <div className="flex items-center justify-between border-b border-edge px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Booking actions</p>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => close()}
                    className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="py-1">
                  <MenuItems
                    id={id}
                    status={status}
                    options={options}
                    canCancel={canCancel}
                    large
                    onClose={() => close(false)}
                    onMutate={onMutate}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Booking actions"
              data-booking-menu-dropdown
              className="fixed z-[200] w-64 overflow-hidden rounded-xl border border-edge bg-surface-raised py-1 shadow-card ring-1 ring-black/50"
              style={
                coords
                  ? { top: coords.top, left: coords.left }
                  : {
                      // Hidden until measured — still in DOM for height.
                      top: -9999,
                      left: -9999,
                      visibility: "hidden",
                    }
              }
            >
              <MenuItems
                id={id}
                status={status}
                options={options}
                canCancel={canCancel}
                onClose={() => close(false)}
                onMutate={onMutate}
              />
            </div>
          ),
          document.body,
        )
      : null;

  return (
    <div className={`relative ${open ? "z-50" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-fill-hover"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </div>
  );
}
