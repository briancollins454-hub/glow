"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, BellRing, Trash2, CheckCircle2, CalendarOff } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gbp, fmtDate, fmtTime } from "@/lib/format";
import { statusBadge } from "@/components/dashboard/status";
import { riskTierLabel, riskTierTone, dateStrInTz } from "@/lib/rules";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingsMonthCalendar } from "@/components/dashboard/bookings-month-calendar";
import { BookingsStaffDayView } from "@/components/dashboard/bookings-staff-day-view";
import { BlockTimeForm } from "@/components/dashboard/block-time-form";
import { RunningLatePanel } from "@/components/dashboard/running-late-panel";
import { ManualBookingForm } from "@/components/dashboard/manual-booking-form";
import { filterLateCascadeBookings } from "@/lib/running-late-filter";
import { bufferMapFromServices } from "@/lib/rules";
import { deleteWaitlistEntryAction } from "../actions";
import type {
  Booking,
  Client,
  Service,
  ServiceAddon,
  ServiceCategory,
  StaffMember,
  TimeOff,
  WaitlistEntry,
  WorkingHour,
} from "@/lib/db/types";

type BookingsData = {
  bookings: Booking[];
  services: Service[];
  categories: ServiceCategory[];
  clients: Client[];
  waitlist: WaitlistEntry[];
  staff?: StaffMember[];
  offs?: TimeOff[];
  hoursByStaff?: Record<string, WorkingHour[]>;
  addons?: ServiceAddon[];
  rotaHours?: import("@/lib/db/types").RotaHour[];
  tech?: Pick<
    import("@/lib/db/types").Tech,
    | "flexibleHoursEnabled"
    | "flexibleStartMinutes"
    | "flexibleEndMinutes"
    | "flexibleLastStartMinutes"
  > | null;
  now: number;
};

export default function BookingsPage() {
  return (
    <AsyncDashboardPage<BookingsData> pageKey="bookings">
      {(data) => <BookingsView {...data} />}
    </AsyncDashboardPage>
  );
}

function BookingsView({
  bookings,
  services,
  categories,
  clients,
  waitlist,
  staff = [],
  offs = [],
  hoursByStaff = {},
  addons = [],
  rotaHours = [],
  tech = null,
  now,
}: BookingsData) {
  const searchParams = useSearchParams();
  const lateDone = searchParams.get("late");
  const lateErr = searchParams.get("lateerr");
  const blockedDone = searchParams.get("blocked");
  const unblockedDone = searchParams.get("unblocked");
  const notified = searchParams.get("notified");
  const minutes = searchParams.get("minutes");
  const noShowFee = searchParams.get("noshowfee");
  const noShowAmt = Number(searchParams.get("noshowamt") ?? "0");
  const bookingError = searchParams.get("error");
  const waiting = waitlist.filter((w) => !w.notifiedAtIso);
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const bufferByServiceId = bufferMapFromServices(services);

  const staffById = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  // Day diary (with tappable blocks) for one or more staff; list-only when no staff rows.
  const showStaff = staff.length >= 1;
  const [selectedDate, setSelectedDate] = useState(() => dateStrInTz(new Date()));

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
        muted ? "border-edge bg-fill" : "bg-cream"
      }`}
    >
      <div className={`min-w-0 flex-1 ${muted ? "text-ink-soft" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`truncate font-medium ${muted ? "text-ink-soft" : ""}`}>
            {clientById[b.clientId] ?? "Client"}
          </p>
          {statusBadge(b.status)}
          {b.groupId && <Badge tone="neutral">Multi</Badge>}
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
        <p className="text-sm text-ink-soft">
          {showStaff
            ? "Month overview plus a day view with a column for each person. Tap a pink-edged Blocked slot to remove it."
            : "All your appointments in one place."}
        </p>
      </div>

      {blockedDone && (
        <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Time blocked. Clients can book around it.</span>
        </div>
      )}
      {unblockedDone && (
        <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Block removed. That slot is bookable again.</span>
        </div>
      )}
      {bookingError === "slot" && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          That time is not free — they may already have a booking, be off, or outside working hours.
          Pick another slot, or tick Custom time to book it anyway. Two bookings can&apos;t share the
          exact same start minute for one person, so stagger them by a minute if you&apos;re
          double-booking.
        </div>
      )}
      {bookingError === "missing" && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          Choose a service and a date &amp; time to add the booking.
        </div>
      )}
      {lateDone && (
        <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Notified {notified ?? "0"} client{(notified === "1" ? "" : "s")} (~{minutes ?? "?"} min late).
          </span>
        </div>
      )}
      {lateErr && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">{lateErr}</div>
      )}
      {noShowFee === "charged" && (
        <div className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{gbp(noShowAmt)} charged to the client&apos;s saved card.</span>
        </div>
      )}
      {noShowFee === "declined" && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          We couldn&apos;t charge {gbp(noShowAmt)} to the saved card — the client&apos;s bank declined it.
          The booking update is still recorded; you can request payment from the client directly.
        </div>
      )}

      {lateTargets.length > 0 && (
        <RunningLatePanel targetCount={lateTargets.length} />
      )}

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-text">
          <Plus className="h-4 w-4" /> Add a booking manually
        </summary>
        <div className="border-t border-edge p-5">
          <ManualBookingForm
            services={services}
            categories={categories}
            clients={clients}
            staff={staff}
            addons={addons}
            bookings={bookings}
            offs={offs}
            hoursByStaff={hoursByStaff}
            rotaHours={rotaHours}
            tech={tech}
          />
        </div>
      </details>

      <BookingsMonthCalendar
        bookings={bookings}
        clientById={clientById}
        serviceById={serviceById}
        selected={selectedDate}
        onSelectedChange={setSelectedDate}
        hideDayList={showStaff}
      />

      <details className="card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-brand-text">
          <CalendarOff className="h-4 w-4" /> Block time out
        </summary>
        <div className="border-t border-edge p-5">
          <BlockTimeForm dateStr={selectedDate} offs={offs} staff={staff} />
        </div>
      </details>

      {showStaff ? (
        <BookingsStaffDayView
          dateStr={selectedDate}
          onDateChange={setSelectedDate}
          bookings={bookings}
          staff={staff}
          clientById={clientById}
          serviceById={serviceById}
          bufferByServiceId={bufferByServiceId}
          offs={offs}
          hoursByStaff={hoursByStaff}
          rotaHours={rotaHours}
        />
      ) : (
        <Card className="ring-1 ring-brand-500/30">
          <CardHeader>
            <CardTitle>Today&apos;s plan ({today.length})</CardTitle>
            <CardDescription>{todayStr}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {today.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-faint">Nothing booked today.</p>
            )}
            {[...today].sort((a, b) => a.startIso.localeCompare(b.startIso)).map((b) => row(b))}
          </CardContent>
        </Card>
      )}

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
                  <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400" title="Remove from list">
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
