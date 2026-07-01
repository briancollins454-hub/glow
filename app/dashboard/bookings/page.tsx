import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listBookings, listClients, listServices } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { BookingActions } from "@/components/dashboard/booking-actions";
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
    <div key={b.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 px-4 py-3 ${muted ? "bg-white opacity-80" : "bg-cream"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{clientById.get(b.clientId) ?? "Client"}</p>
          {statusBadge(b.status)}
          {b.depositStatus === "forfeited" && <Badge tone="red">Deposit forfeited</Badge>}
        </div>
        <p className="text-xs text-ink-faint">
          {serviceById.get(b.serviceId) ?? "Service"} · {fmtDate(b.startIso)} at {fmtTime(b.startIso)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-sm">
          <p className="font-medium">{gbp(b.pricePennies)}</p>
          <p className="text-xs text-ink-faint">{b.balanceStatus === "paid" ? "paid in full" : `${gbp(b.balancePennies)} due`}</p>
        </div>
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
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-700">
          <Plus className="h-4 w-4" /> Add a booking manually
        </summary>
        <div className="border-t border-black/5 p-5">
          <form action={addManualBookingAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Existing client</Label>
              <Select name="clientId" defaultValue="">
                <option value="">— new client —</option>
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
            <div><Label>Date &amp; time</Label><Input name="startsAt" type="datetime-local" required /></div>
            <div><Label>Email</Label><Input name="clientEmail" type="email" placeholder="(optional)" /></div>
            <div><Label>Phone</Label><Input name="clientPhone" placeholder="(optional)" /></div>
            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Add booking</Button></div>
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
