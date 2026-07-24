"use client";

import Link from "next/link";
import { Banknote, CheckCircle2, ClipboardList } from "lucide-react";
import {
  settlePastBookingAction,
  setBookingStatusAction,
} from "@/app/dashboard/actions";
import { clearDashboardCache } from "@/lib/dashboard/client-cache";
import { statusBadge } from "@/components/dashboard/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { Select } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gbp, fmtDate, fmtTime } from "@/lib/format";
import type { Booking, Client, Service } from "@/lib/db/types";
import { bookingAmountDue } from "@/lib/booking/payment-summary";

function amountDue(b: Booking): number {
  return bookingAmountDue(b);
}

function needsComplete(b: Booking): boolean {
  return b.status === "pending_approval" || b.status === "pending" || b.status === "confirmed";
}

export function SettleUpPanel({
  bookings,
  clientById,
  serviceById,
}: {
  bookings: Booking[];
  clientById: Record<string, Client>;
  serviceById: Record<string, Service>;
}) {
  if (bookings.length === 0) return null;

  const totalDue = bookings.reduce((sum, b) => sum + amountDue(b), 0);
  const onMutate = () => clearDashboardCache();

  return (
    <Card className="ring-1 ring-amber-500/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-warning-text" />
          Settle up ({bookings.length})
        </CardTitle>
        <CardDescription>
          Past appointments still open
          {totalDue > 0 ? (
            <>
              {" "}
              · <span className="font-medium text-amber-200">{gbp(totalDue)} due</span>
            </>
          ) : null}
          . Mark complete and cash off without digging through the calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.map((b) => {
          const due = amountDue(b);
          const incomplete = needsComplete(b);
          const settleLabel =
            incomplete && due > 0
              ? `Complete & cash ${gbp(due)}`
              : incomplete
                ? "Mark completed"
                : `Cash off ${gbp(due)}`;

          return (
            <div
              key={b.id}
              className="rounded-xl border border-edge bg-cream px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/dashboard/bookings/${b.id}`}
                      className="truncate font-medium hover:text-brand-text"
                    >
                      {clientById[b.clientId]?.name ?? "Client"}
                    </Link>
                    {statusBadge(b.status)}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {serviceById[b.serviceId]?.name ?? "Service"} · {fmtDate(b.startIso)} at{" "}
                    {fmtTime(b.startIso)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    <span className="font-medium text-ink">{gbp(b.pricePennies)}</span>
                    {" · "}
                    {due > 0 ? (
                      <span className="font-medium text-amber-200">{gbp(due)} still due</span>
                    ) : (
                      "paid in full"
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <form
                  action={settlePastBookingAction}
                  onSubmit={onMutate}
                  className="flex flex-1 flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="returnTo" value="/dashboard" />
                  {due > 0 && (
                    <Select name="method" defaultValue="cash" className="w-auto min-w-[8.5rem]">
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="paypal">PayPal</option>
                      <option value="card_machine">Card machine</option>
                      <option value="other">Other</option>
                    </Select>
                  )}
                  <SubmitButton size="sm" pendingLabel="Saving…">
                    {incomplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Banknote className="h-3.5 w-3.5" />
                    )}
                    {settleLabel}
                  </SubmitButton>
                </form>

                {incomplete && (
                  <form action={setBookingStatusAction} onSubmit={onMutate}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <input type="hidden" name="cancelReason" value="client_late_cancel" />
                    <input type="hidden" name="returnTo" value="/dashboard" />
                    <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
                      Cancel late
                    </SubmitButton>
                  </form>
                )}

                {incomplete && (
                  <form action={setBookingStatusAction} onSubmit={onMutate}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <input type="hidden" name="cancelReason" value="tech_cancelled" />
                    <input type="hidden" name="returnTo" value="/dashboard" />
                    <SubmitButton size="sm" variant="ghost" pendingLabel="Cancelling…">
                      Cancel &amp; refund
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
