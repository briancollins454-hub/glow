"use client";

import { useSearchParams } from "next/navigation";
import { Plus, BellRing, Trash2, CheckCircle2 } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { riskTierLabel, riskTierTone, dateStrInTz } from "@/lib/rules";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingsMonthCalendar } from "@/components/dashboard/bookings-month-calendar";
import { LazyDateTimePicker } from "@/components/dashboard/lazy-date-time-picker";
import { RunningLatePanel } from "@/components/dashboard/running-late-panel";
import { filterLateCascadeBookings } from "@/lib/running-late-filter";
import { addManualBookingAction, deleteWaitlistEntryAction } from "../actions";
import type { Booking, Client, Service, StaffMember, WaitlistEntry } from "@/lib/db/types";

type BookingsData = {
  bookings: Booking[];
  services: Service[];
  clients: Client[];
  waitlist: WaitlistEntry[];
  staff?: StaffMember[];
  now: number;
};

export default function BookingsPage() {
  return (
    <AsyncDashboardPage<BookingsData> pageKey="bookings">
      {(data) => <BookingsView {...data} />}
    </AsyncDashboardPage>
  );
}

function BookingsView({ bookings, services, clients, waitlist, staff = [], now }: BookingsData) {
  const searchParams = useSearchParams();
  const lateDone = searchParams.get("late");
  const lateErr = searchParams.get("lateerr");
  const notified = searchParams.get("notified");
  const minutes = searchParams.get("minutes");
  const noShowFee = searchParams.get("noshowfee");
  const noShowAmt = Number(searchParams.get("noshowamt") ?? "0");
  const waiting = waitlist.filter((w) => !w.notifiedAtIso);
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s.name]));

  const staffById = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const showStaff = staff.length > 1;

  const todayStr = fmtDate(new Date().toISOString());
  const todayKey = dateStrInTz(new Date());
  const notCancelled = bookings.filter((b) => b.status !== "cancelled");
  const today = notCancelled.filter((b) => fmtDate(b.startIso) === todayStr);
  const lateTargets = filterLateCascadeBookings(today, todayKey, now);
  const upcoming = notCancelled.filter(
    (b) => new Date(b.startIso).getTime() >= now && fmtDate(b.startIso) !== todayStr,
  );
  const past = bookings
    .filter(
      (b) =>
        (new Date(b.startIso).getTime() < now || b.status === "cancelled") &&
        fmtDate(b.startIso) !== todayStr,
    )
    .reverse();

  const row = (b: Booking, muted?: boolean) => (
    // Do not put opacity on this row — it makes the actions menu translucent
    // and creates a stacking context that lets sibling cards steal clicks.
    <div
      key={b.id}
      className={`flex items-center justify-between gap-2 rounded-xl border border-edge px-4 py-3 ${
        muted ? "border-edge/60 bg-white/[0.02]" : "bg-cream"
      }`}
    >
      <div className={`min-w-0 flex-1 ${muted ? "text-ink-soft" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`truncate font-medium ${muted ? "text-ink-soft" : ""}`}>
            {clientById[b.clientId] ?? "Client"}
          </p>
          {statusBadge(b.status)}
          {b.riskTier && b.status === "pending_approval" && (
            <Badge tone={riskTierTone(b.riskTier)}>{riskTierLabel(b.riskTier)}</Badge>
          )}
          {b.depositStatus === "forfeited" && <Badge tone="red">Deposit kept</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          {serviceById[b.serviceId] ?? "Service"} · {fmtDate(b.startIso)} at {fmtTime(b.startIso)}
          {showStaff && b.staffId && staffById[b.staffId] ? ` · with ${staffById[b.staffId]}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          <span className={`font-medium ${muted ? "text-ink-soft" : "text-ink"}`}>
            {gbp(b.pricePennies)}
          </span>
          {" · "}
          {b.balanceStatus === "paid" ? "paid in full" : `${gbp(b.balancePennies)} due`}
        </p>
      </div>
      <div className="relative shrink-0">
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

      {lateDone && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Notified {notified ?? "0"} client{(notified === "1" ? "" : "s")} (~{minutes ?? "?"} min late).
          </span>
        </div>
      )}
      {lateErr && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{lateErr}</div>
      )}
      {noShowFee === "charged" && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No-show fee of {gbp(noShowAmt)} charged to the client&apos;s saved card.</span>
        </div>
      )}
      {noShowFee === "declined" && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          We couldn&apos;t charge the {gbp(noShowAmt)} no-show fee — the client&apos;s bank declined it.
          The no-show is still recorded; you can request payment from the client directly.
        </div>
      )}

      {lateTargets.length > 0 && (
        <RunningLatePanel targetCount={lateTargets.length} />
      )}

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
            {staff.length > 1 && (
              <div>
                <Label>With</Label>
                <Select name="staffId" defaultValue={staff[0]?.id ?? ""}>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div><Label>New client name</Label><Input name="clientName" placeholder="(if new)" /></div>
            <div><Label>Email</Label><Input name="clientEmail" type="email" placeholder="(optional)" /></div>
            <div><Label>Phone</Label><Input name="clientPhone" placeholder="(optional)" /></div>
            <p className="text-xs text-ink-faint sm:col-span-2">
              Add an email or mobile if you want them to get confirmations and reminders — without one, those are skipped.
            </p>
            <div className="sm:col-span-2">
              <Label>Date &amp; time</Label>
              <LazyDateTimePicker name="startsAt" />
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

      <BookingsMonthCalendar
        bookings={bookings}
        clientById={clientById}
        serviceById={serviceById}
      />

      <Card className="ring-1 ring-brand-500/30">
        <CardHeader>
          <CardTitle>Today&apos;s plan ({today.length})</CardTitle>
          <CardDescription>{todayStr}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {today.length === 0 && <p className="py-4 text-center text-sm text-ink-faint">Nothing booked today.</p>}
          {[...today].sort((a, b) => a.startIso.localeCompare(b.startIso)).map((b) => row(b))}
        </CardContent>
      </Card>

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

      {waiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-brand-400" /> Cancellation list ({waiting.length})
            </CardTitle>
            <CardDescription>
              Clients waiting for a slot. They&apos;re emailed automatically the moment a booking is cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {waiting.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{w.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {w.serviceId ? serviceById[w.serviceId] ?? "Any service" : "Any service"}
                    {" · "}
                    {w.dateStr ? `wants ${fmtDate(`${w.dateStr}T12:00:00Z`)}` : "any day"}
                    {" · "}
                    {w.email}
                  </p>
                </div>
                <form action={deleteWaitlistEntryAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400" title="Remove from list">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Past &amp; cancelled</CardTitle></CardHeader>
          <CardContent className="space-y-2">{past.slice(0, 30).map((b) => row(b, true))}</CardContent>
        </Card>
      )}
    </div>
  );
}
