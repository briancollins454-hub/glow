import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listBookings, listClients, listServices } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { DateTimePicker } from "@/components/dashboard/date-time-picker";
import { addManualBookingAction } from "../actions";
import type { Booking } from "@/lib/db/types";

export default async function BookingsPage() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;

  const now = Date.now();
  const [bookings, services, clients] = await Promise.all([
    listBookings(sb, tech.id),
    listServices(sb, tech.id),
    listClients(sb, tech.id),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c.name]));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));

  const upcoming = bookings.filter((b) => new Date(b.startIso).getTime() >= now && b.status !== "cancelled");
  const past = bookings
    .filter((b) => new Date(b.startIso).getTime() < now || b.status === "cancelled")
    .reverse();

  const row = (b: Booking, muted?: boolean) => (
    <div key={b.id} className={`flex items-center justify-between gap-2 rounded-xl border border-edge px-4 py-3 ${muted ? "bg-white/[0.03] opacity-70" : "bg-cream"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-medium">{clientById.get(b.clientId) ?? "Client"}</p>
          {statusBadge(b.status)}
          {b.depositStatus === "forfeited" && <Badge tone="red">Deposit forfeited</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          {serviceById.get(b.serviceId) ?? "Service"} · {fmtDate(b.startIso)} at {fmtTime(b.startIso)}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          <span className="font-medium text-ink">{gbp(b.pricePennies)}</span>
          {" · "}
          {b.balanceStatus === "paid" ? "paid in full" : `${gbp(b.balancePennies)} due`}
        </p>
      </div>
      <div className="shrink-0">
        <BookingActions id={b.id} status={b.status} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-ink-soft">All your appointments in one place.</p>
      </div>

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-300">
          <Plus className="h-4 w-4" /> Add a booking manually
        </summary>
        <div className="border-t border-edge p-5">
          <form action={addManualBookingAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Existing client</Label>
              <Select name="clientId" defaultValue="">
                <option value="">- new client -</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Service</Label>
              <Select name="serviceId" required defaultValue="">
                <option value="" disabled>Choose a service</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {gbp(s.pricePennies)}</option>)}
              </Select>
            </div>
            <div><Label>New client name</Label><Input name="clientName" placeholder="(if new)" /></div>
            <div><Label>Email</Label><Input name="clientEmail" type="email" placeholder="(optional)" /></div>
            <div><Label>Phone</Label><Input name="clientPhone" placeholder="(optional)" /></div>
            <div className="sm:col-span-2">
              <Label>Date &amp; time</Label>
              <DateTimePicker name="startsAt" />
            </div>
            <div>
              <Label>Deposit for this booking (£)</Label>
              <Input name="depositPounds" type="number" min={0} step="0.01" placeholder="Blank = service default, 0 = none" />
            </div>
            <div>
              <Label>Payment taken?</Label>
              <Select name="paymentTaken" defaultValue="none">
                <option value="none">Nothing yet</option>
                <option value="deposit">Deposit taken</option>
                <option value="full">Paid in full</option>
              </Select>
            </div>
            <div>
              <Label>How was it paid?</Label>
              <Select name="paymentMethod" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="paypal">PayPal</option>
                <option value="card_machine">Card machine</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="sm:col-span-2"><SubmitButton variant="secondary" pendingLabel="Adding…">Add booking</SubmitButton></div>
          </form>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming ({upcoming.length})</CardTitle>
          <CardDescription>Confirm, complete, cancel or flag no-shows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 && <p className="py-4 text-center text-sm text-ink-faint">No upcoming bookings.</p>}
          {upcoming.map((b) => row(b))}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Past &amp; cancelled</CardTitle></CardHeader>
          <CardContent className="space-y-2">{past.slice(0, 30).map((b) => row(b, true))}</CardContent>
        </Card>
      )}
    </div>
  );
}
