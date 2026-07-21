"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { deleteTimeOffAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtTime } from "@/lib/format";
import type { TimeOff } from "@/lib/db/types";

type SheetMode = "detail" | "confirm";

/**
 * Tappable manual time block on the team/diary calendar.
 * Opens a sheet with details; Delete asks for confirmation (Cancel is the safe default).
 * Deleting one row only removes that staff member's block (multi-staff creates one row each).
 */
export function CalendarManualBlock({
  block,
  staffName,
  style,
}: {
  block: TimeOff;
  staffName: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SheetMode>("detail");
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "confirm") setMode("detail");
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode]);

  useEffect(() => {
    if (open && mode === "confirm") {
      cancelRef.current?.focus();
    }
  }, [open, mode]);

  const whose = block.staffId ? staffName : "Everyone";

  function close() {
    setOpen(false);
    setMode("detail");
  }

  return (
    <>
      <button
        type="button"
        className="calendar-manual-block absolute inset-x-1 z-[1] overflow-hidden rounded-lg border px-1.5 py-1 text-left touch-manipulation"
        style={style}
        title={`${block.reason?.trim() || "Blocked"} · tap to manage`}
        aria-label={`Blocked ${fmtTime(block.startIso)} to ${fmtTime(block.endIso)}${block.reason ? `: ${block.reason}` : ""}. Tap to manage or delete.`}
        onClick={() => {
          setMode("detail");
          setOpen(true);
        }}
      >
        <p className="calendar-manual-block-label truncate text-[10px] font-semibold">Blocked</p>
        {block.reason?.trim() ? (
          <p className="truncate text-[10px] text-ink-faint">{block.reason.trim()}</p>
        ) : (
          <p className="truncate text-[10px] text-ink-faint">Tap to remove</p>
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--overlay)] p-4 sm:items-center"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
                {mode === "confirm" ? "Delete this block?" : "Time block"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1 text-ink-faint hover:bg-fill-hover hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === "detail" ? (
              <div className="mt-3 space-y-3 text-sm">
                <dl className="space-y-2 text-ink-soft">
                  <div className="flex justify-between gap-3">
                    <dt>Whose diary</dt>
                    <dd className="font-medium text-ink">{whose}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>From</dt>
                    <dd className="font-medium text-ink">{fmtTime(block.startIso)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>To</dt>
                    <dd className="font-medium text-ink">{fmtTime(block.endIso)}</dd>
                  </div>
                  {block.reason?.trim() ? (
                    <div className="flex justify-between gap-3">
                      <dt>Reason</dt>
                      <dd className="max-w-[60%] text-right font-medium text-ink">{block.reason.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
                {block.staffId ? (
                  <p className="text-xs text-ink-faint">
                    Deleting removes this block for {staffName} only. Other team members kept their own
                    blocks if you blocked several people at once.
                  </p>
                ) : (
                  <p className="text-xs text-ink-faint">
                    This is a whole-salon block. Deleting it frees the slot for everyone.
                  </p>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode("confirm")}
                    className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger-text hover:opacity-90"
                  >
                    Delete block
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-fill-hover"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-4 text-sm">
                <p className="text-ink-soft">
                  Are you sure you want to delete this block? The slot will become bookable again.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <form action={deleteTimeOffAction}>
                    <input type="hidden" name="id" value={block.id} />
                    <input type="hidden" name="returnTo" value="/dashboard/bookings" />
                    <SubmitButton
                      pendingLabel="Deleting…"
                      variant="secondary"
                      className="w-full border-0 bg-danger-soft text-danger-text hover:opacity-90 sm:w-auto"
                    >
                      Yes, delete
                    </SubmitButton>
                  </form>
                  <button
                    ref={cancelRef}
                    type="button"
                    onClick={() => setMode("detail")}
                    className="rounded-xl border border-brand-400/50 bg-brand-500/10 px-4 py-2.5 text-sm font-medium text-brand-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Rota / outside working hours: tappable info only, never deletable. */
export function CalendarRotaUnavailable({
  staffName,
  style,
}: {
  staffName: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="calendar-unavailable calendar-rota-unavailable absolute inset-x-1 z-[1] overflow-hidden rounded-lg border border-edge px-1.5 py-1 text-left touch-manipulation"
        style={style}
        title="Outside working hours"
        aria-label={`Outside working hours for ${staffName}. Tap for details.`}
        onClick={() => setOpen(true)}
      >
        <p className="calendar-unavailable-label truncate text-[10px] font-medium">Unavailable</p>
        <p className="truncate text-[10px] text-ink-faint">Outside hours</p>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--overlay)] p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
              Outside working hours
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              This shading is not a removable block. It is time outside {staffName}&apos;s working
              hours. Edit hours under Opening hours or Team → Week rota.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-fill-hover"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
