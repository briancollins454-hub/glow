"use client";

import { useSearchParams } from "next/navigation";
import { BellRing, Mail, MessageSquare, Play, CheckCircle2 } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";
import { renderReminderText, labelForKind } from "@/lib/reminder-copy";
import { runRemindersAction } from "../actions";
import type { Booking, Client, InfillDeadlineNudge, PreCareConfirmation, ReactionCheckin, Reminder, Service, Tech } from "@/lib/db/types";

type RemindersData = {
  reminders: Reminder[];
  services: Service[];
  bookings: Booking[];
  clients: Client[];
  checkins: ReactionCheckin[];
  infillNudges: InfillDeadlineNudge[];
  preCare: PreCareConfirmation[];
  tech: Tech;
};

export default function RemindersPage() {
  return (
    <AsyncDashboardPage<RemindersData> pageKey="reminders">
      {(data) => <RemindersView {...data} />}
    </AsyncDashboardPage>
  );
}

function RemindersView({ reminders, services, bookings, clients, checkins, infillNudges, preCare, tech }: RemindersData) {
  const searchParams = useSearchParams();
  const ran = searchParams.get("ran");

  const bookingById = Object.fromEntries(bookings.map((b) => [b.id, b]));
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));

  const preview = (r: Reminder) => {
    if (r.kind === "patch_test_retest") return r.preview || "Patch test re-test notification";
    const booking = r.bookingId ? bookingById[r.bookingId] : null;
    if (!booking) return r.preview || "(booking not found)";
    return (
      r.preview ||
      renderReminderText({
        reminder: r,
        booking,
        client: clientById[booking.clientId] ?? null,
        service: serviceById[booking.serviceId] ?? null,
        tech,
      })
    );
  };
  const clientName = (r: Reminder) => {
    if (r.clientId && clientById[r.clientId]?.name) return clientById[r.clientId]!.name;
    const b = r.bookingId ? bookingById[r.bookingId] : null;
    return (b && clientById[b.clientId]?.name) || "Client";
  };

  const scheduled = reminders.filter((r) => r.status === "scheduled");
  const sent = reminders.filter((r) => r.status === "sent").reverse();
  const checkinsScheduled = checkins.filter((c) => c.status === "scheduled");
  const checkinsSent = checkins.filter((c) => c.status === "sent" || c.status === "responded");
  const infillScheduled = infillNudges.filter((n) => n.status === "scheduled");
  const infillDone = infillNudges.filter((n) => n.status === "sent" || n.status === "skipped");
  const preCareScheduled = preCare.filter((p) => p.status === "scheduled");
  const preCareDone = preCare.filter((p) => p.status !== "scheduled");

  const rowEl = (r: Reminder, done?: boolean) => (
    <div key={r.id} className="rounded-xl border border-edge bg-cream px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {r.channel === "email" ? <Mail className="h-4 w-4 text-sky-600" /> : <MessageSquare className="h-4 w-4 text-violet-600" />}
          <span className="font-medium">{clientName(r)}</span>
          <Badge tone={r.channel === "email" ? "blue" : "purple"}>{labelForKind(r.kind)}</Badge>
        </div>
        <span className="text-xs text-ink-faint">{done ? "Sent" : "Sends"} {fmtDateTime(done && r.sentAtIso ? r.sentAtIso : r.sendAtIso)}</span>
      </div>
      <p className="mt-2 rounded-lg bg-fill-hover px-3 py-2 text-sm text-ink-soft">{preview(r)}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reminders</h1>
          <p className="text-sm text-ink-soft">Confirmations, pre-care, infill deadlines, reaction check-ins and more. Sent automatically every 15 minutes.</p>
        </div>
        <form action={runRemindersAction}><Button type="submit" variant="secondary"><Play className="h-4 w-4" /> Run due now</Button></form>
      </div>

      {ran && <div className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text"><CheckCircle2 className="h-4 w-4" /> Processed any due reminders.</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-400" /> Reaction check-ins ({checkinsScheduled.length} scheduled)</CardTitle>
          <CardDescription>Sent 48 hours after patch tests and chemical treatments. Clients reply via a one-tap link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {checkinsScheduled.length === 0 && checkinsSent.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No reaction check-ins yet.</p>
          )}
          {checkinsScheduled.map((c) => (
            <div key={c.id} className="rounded-xl border border-edge bg-cream px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[c.clientId]?.name ?? "Client"}</span>
                <Badge tone="amber">48h check-in</Badge>
                <span className="text-xs text-ink-faint">Sends {fmtDateTime(c.sendAtIso)}</span>
              </div>
            </div>
          ))}
          {checkinsSent.slice(0, 15).map((c) => (
            <div key={c.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[c.clientId]?.name ?? "Client"}</span>
                <Badge tone={c.response === "reaction" ? "red" : c.response === "fine" ? "green" : "neutral"}>
                  {c.status === "responded"
                    ? c.response === "reaction"
                      ? "Reaction reported"
                      : "All fine"
                    : "Sent"}
                </Badge>
              </div>
              {c.symptoms && <p className="mt-1 text-xs text-ink-faint">{c.symptoms}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-purple-400" /> Infill deadlines ({infillScheduled.length} scheduled)</CardTitle>
          <CardDescription>Sent 3 days before a client&apos;s infill window closes, after a full set is completed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {infillScheduled.length === 0 && infillDone.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No infill deadline nudges yet.</p>
          )}
          {infillScheduled.map((n) => (
            <div key={n.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[n.clientId]?.name ?? "Client"}</span>
                <Badge tone="purple">Infill deadline</Badge>
                <span className="text-xs text-ink-faint">Sends {fmtDateTime(n.sendAtIso)} · closes {fmtDateTime(n.deadlineIso)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {serviceById[n.infillServiceId]?.name ?? "Infill"} · after full set on{" "}
                {bookingById[n.baseBookingId] ? fmtDateTime(bookingById[n.baseBookingId]!.startIso) : "—"}
              </p>
            </div>
          ))}
          {infillDone.slice(0, 15).map((n) => (
            <div key={n.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[n.clientId]?.name ?? "Client"}</span>
                <Badge tone={n.status === "sent" ? "green" : "neutral"}>
                  {n.status === "sent" ? "Sent" : "Skipped"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-sky-400" /> Pre-care ({preCareScheduled.length} scheduled)</CardTitle>
          <CardDescription>Sent 48 hours before appointments when a service has pre-care notes. Clients confirm via a one-tap link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {preCareScheduled.length === 0 && preCareDone.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No pre-care confirmations yet. Add pre-care notes on a service to enable them.</p>
          )}
          {preCareScheduled.map((p) => (
            <div key={p.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[p.clientId]?.name ?? "Client"}</span>
                <Badge tone="blue">Pre-care</Badge>
                <span className="text-xs text-ink-faint">Sends {fmtDateTime(p.sendAtIso)}</span>
              </div>
              {bookingById[p.bookingId] && (
                <p className="mt-1 text-xs text-ink-faint">
                  {serviceById[bookingById[p.bookingId]!.serviceId]?.name ?? "Service"} ·{" "}
                  {fmtDateTime(bookingById[p.bookingId]!.startIso)}
                </p>
              )}
            </div>
          ))}
          {preCareDone.slice(0, 15).map((p) => (
            <div key={p.id} className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{clientById[p.clientId]?.name ?? "Client"}</span>
                <Badge tone={p.status === "confirmed" ? "green" : p.status === "sent" ? "amber" : "neutral"}>
                  {p.status === "confirmed" ? "Confirmed" : p.status === "sent" ? "Awaiting confirm" : "Skipped"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-brand-400" /> Scheduled ({scheduled.length})</CardTitle>
          <CardDescription>Waiting to send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {scheduled.length === 0 && <p className="py-3 text-center text-sm text-ink-faint">Nothing scheduled.</p>}
          {scheduled.map((r) => rowEl(r))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sent ({sent.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sent.length === 0 && <p className="py-3 text-center text-sm text-ink-faint">Nothing sent yet.</p>}
          {sent.slice(0, 30).map((r) => rowEl(r, true))}
        </CardContent>
      </Card>
    </div>
  );
}
