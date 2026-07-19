import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, CheckCircle2, Banknote, Trash2, Beaker, ClipboardList, CalendarDays } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import {
  getBooking,
  getClient,
  getService,
  listProductBatches,
  listProducts,
  listServices,
  productUsagesForClient,
} from "@/lib/db/queries";
import { preCareForBooking } from "@/lib/pre-care";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/dashboard/date-time-picker";
import { statusBadge } from "@/components/dashboard/status";
import { gbp, TZ, fmtDateTime } from "@/lib/format";
import { rescheduleBookingAction, recordManualPaymentAction, deleteBookingAction, logBookingProductUsageAction } from "../../actions";
import { GoogleBookingSyncButton } from "@/components/dashboard/google-booking-sync-button";

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; err?: string; usage?: string }>;
}) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const { id } = await params;
  const { saved, err, usage } = await searchParams;

  const booking = await getBooking(sb, id);
  if (!booking || booking.techId !== tech.id) notFound();
  const [client, service, services, products, batches, usages, preCare, bookingStaff] =
    await Promise.all([
      getClient(sb, booking.clientId),
      getService(sb, booking.serviceId),
      listServices(sb, tech.id, { activeOnly: true }),
      listProducts(sb, tech.id),
      listProductBatches(sb, tech.id),
      productUsagesForClient(sb, tech.id, booking.clientId),
      preCareForBooking(sb, booking.id).catch(() => null),
      booking.staffId
        ? import("@/lib/db/queries").then((m) => m.getStaff(sb, booking.staffId!)).catch(() => null)
        : Promise.resolve(null),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const activeBatches = batches.filter((b) => !b.retiredAtIso);
  const batchOptions = activeBatches
    .map((batch) => {
      const product = productById.get(batch.productId);
      if (!product || product.categoryId !== service?.categoryId) return null;
      const lot = batch.lotNumber ? ` · Lot ${batch.lotNumber}` : "";
      return {
        batch,
        label: `${product.name}${product.brand ? ` (${product.brand})` : ""}${lot}`,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o != null);
  const bookingUsages = usages.filter((u) => u.bookingId === booking.id);

  // Prefill the picker with the booking's current local date/time.
  const currentLocal = formatInTimeZone(new Date(booking.startIso), TZ, "yyyy-MM-dd'T'HH:mm");
  const depositOutstanding = booking.depositPennies > 0 && booking.depositStatus !== "paid";
  const balanceOutstanding = booking.balancePennies > 0 && booking.balanceStatus !== "paid";
  const googleConnected = !!tech.googleRefreshToken && !!tech.googleCalendarId;
  const canSyncGoogle =
    googleConnected &&
    booking.status === "confirmed" &&
    new Date(booking.startIso).getTime() > Date.now() - 15 * 60 * 1000;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Calendar
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{client?.name ?? "Booking"}</h1>
        {statusBadge(booking.status)}
        {bookingStaff && (
          <span className="rounded-full border border-edge bg-cream px-3 py-1 text-xs font-medium text-ink-soft">
            with {bookingStaff.name}
          </span>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Booking updated.
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Please pick a service, date and time.
        </div>
      )}
      {usage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Product batch logged for this appointment.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit booking</CardTitle>
          <CardDescription>
            Move the appointment or switch the service. The client keeps their payment history and gets fresh reminders for the new time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={rescheduleBookingAction} className="space-y-4">
            <input type="hidden" name="id" value={booking.id} />
            <div>
              <Label>Service</Label>
              <Select name="serviceId" defaultValue={booking.serviceId}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {gbp(s.pricePennies)}</option>
                ))}
                {!services.some((s) => s.id === booking.serviceId) && service && (
                  <option value={service.id}>{service.name} · {gbp(service.pricePennies)}</option>
                )}
              </Select>
            </div>
            <div>
              <Label>Date &amp; time</Label>
              <DateTimePicker name="startsAt" defaultValue={currentLocal} />
            </div>
            <div>
              <Label>Deposit for this booking (£)</Label>
              {booking.depositStatus === "paid" ? (
                <p className="rounded-xl border border-edge bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-soft">
                  {gbp(booking.depositPennies)} - already paid, so the amount is locked.
                </p>
              ) : (
                <>
                  <Input
                    name="depositPounds"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={(booking.depositPennies / 100).toFixed(2)}
                  />
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Set to 0 for no deposit - the client pays the full {gbp(booking.pricePennies)} on the day.
                  </p>
                </>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Lash map</Label><Input name="lashMap" defaultValue={booking.lashMap} placeholder="e.g. Cat eye" /></div>
              <div><Label>Curl</Label><Input name="lashCurl" defaultValue={booking.lashCurl} placeholder="e.g. C / CC / D" /></div>
              <div><Label>Length</Label><Input name="lashLength" defaultValue={booking.lashLength} placeholder="e.g. 8-12mm" /></div>
            </div>
            {booking.addons.length > 0 && (
              <div>
                <Label>Extras chosen</Label>
                <div className="flex flex-wrap gap-2">
                  {booking.addons.map((a, i) => (
                    <Badge key={i} tone="brand">{a.name} +{gbp(a.pricePennies)}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea name="notes" defaultValue={booking.notes} placeholder="Anything to remember for this appointment" />
            </div>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {canSyncGoogle && (
        <Card className="border-brand-500/30 bg-brand-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-400" /> Google Calendar
            </CardTitle>
            <CardDescription>Push this appointment to your connected Google Calendar.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleBookingSyncButton bookingId={booking.id} hasGoogleEvent={!!booking.googleEventId} />
          </CardContent>
        </Card>
      )}

      {service?.precareText?.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-sky-400" />
              Pre-care
            </CardTitle>
            <CardDescription>
              Instructions are emailed 48 hours before the appointment. Clients confirm via a one-tap link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap rounded-xl border border-edge bg-cream px-4 py-3 text-sm text-ink-soft">
              {service.precareText}
            </p>
            {preCare ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  tone={
                    preCare.status === "confirmed"
                      ? "green"
                      : preCare.status === "sent"
                        ? "amber"
                        : preCare.status === "scheduled"
                          ? "blue"
                          : "neutral"
                  }
                >
                  {preCare.status === "confirmed"
                    ? "Client confirmed"
                    : preCare.status === "sent"
                      ? "Sent — awaiting confirm"
                      : preCare.status === "scheduled"
                        ? `Scheduled ${fmtDateTime(preCare.sendAtIso)}`
                        : "Skipped"}
                </Badge>
                {preCare.confirmedAtIso && (
                  <span className="text-xs text-ink-faint">Confirmed {fmtDateTime(preCare.confirmedAtIso)}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Pre-care will be scheduled when reminders are set for this booking.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Payments</CardTitle>
          <CardDescription>Record money taken outside Glow: cash, bank transfer, PayPal, card machine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone={booking.depositStatus === "paid" ? "green" : booking.depositStatus === "forfeited" ? "red" : "neutral"}>
              Deposit {gbp(booking.depositPennies)} · {booking.depositStatus === "none" ? "not taken" : booking.depositStatus}
            </Badge>
            {booking.cardPaymentMethodId && (
              <Badge tone="green">Card saved — no-show fee can be charged</Badge>
            )}
            <Badge tone={booking.balanceStatus === "paid" ? "green" : "neutral"}>
              Balance {gbp(booking.balancePennies)} · {booking.balanceStatus}
            </Badge>
            {booking.discountPennies > 0 && (
              <Badge tone="purple">Loyalty discount -{gbp(booking.discountPennies)}</Badge>
            )}
          </div>

          {depositOutstanding || balanceOutstanding ? (
            <form action={recordManualPaymentAction} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={booking.id} />
              <div>
                <Label>What was paid</Label>
                <Select name="what" defaultValue={depositOutstanding ? "deposit" : "balance"}>
                  {depositOutstanding && <option value="deposit">Deposit ({gbp(booking.depositPennies)})</option>}
                  {balanceOutstanding && <option value="balance">Balance ({gbp(booking.balancePennies)})</option>}
                  {depositOutstanding && balanceOutstanding && (
                    <option value="full">Everything ({gbp(booking.depositPennies + booking.balancePennies)})</option>
                  )}
                </Select>
              </div>
              <div>
                <Label>How</Label>
                <Select name="method" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="card_machine">Card machine</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="flex items-end">
                <SubmitButton variant="secondary" className="w-full" pendingLabel="Recording…">Record payment</SubmitButton>
              </div>
            </form>
          ) : (
            <p className="text-sm text-ink-faint">Nothing outstanding on this booking.</p>
          )}
        </CardContent>
      </Card>

      {batchOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-brand-400" /> Products used
            </CardTitle>
            <CardDescription>
              Log which batch was used on this client for traceability if they report a reaction later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookingUsages.length > 0 && (
              <ul className="space-y-2 text-sm">
                {bookingUsages.map((u) => {
                  const batch = batches.find((b) => b.id === u.batchId);
                  const product = batch ? productById.get(batch.productId) : null;
                  return (
                    <li key={u.id} className="rounded-xl border border-edge bg-cream px-4 py-2.5">
                      {product?.name ?? "Product"}
                      {batch?.lotNumber && <span className="text-ink-faint"> · Lot {batch.lotNumber}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            <form action={logBookingProductUsageAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div className="min-w-48 flex-1">
                <Label>Batch</Label>
                <Select name="batchId" required defaultValue="">
                  <option value="" disabled>Choose batch</option>
                  {batchOptions.map((o) => (
                    <option key={o.batch.id} value={o.batch.id}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <SubmitButton variant="secondary" pendingLabel="Logging…">Log product</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-red-400">Booked by mistake?</CardTitle>
          <CardDescription>
            Deleting removes this booking completely: no cancellation on the client&apos;s record, no strike, reminders binned. Use Cancel (in the calendar) instead when the client actually cancels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteBookingAction}>
            <input type="hidden" name="id" value={booking.id} />
            <Button type="submit" variant="danger">
              <Trash2 className="h-4 w-4" /> Delete booking
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
