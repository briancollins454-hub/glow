import { redirect } from "next/navigation";
import { BellRing, Mail, MessageSquare, Play, CheckCircle2 } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { getTechById, listBookings, listClients, listReminders, listServices } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";
import { renderReminderText, labelForKind } from "@/lib/notify";
import { runRemindersAction } from "../actions";
import type { Reminder } from "@/lib/db/types";

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ ran?: string }> }) {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const { ran } = await searchParams;

  const [reminders, bookings, clients, services] = await Promise.all([
    listReminders(sb, tech.id),
    listBookings(sb, tech.id),
    listClients(sb, tech.id),
    listServices(sb, tech.id),
  ]);
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const preview = (r: Reminder) => {
    const booking = bookingById.get(r.bookingId);
    if (!booking) return r.preview || "(booking not found)";
    return (
      r.preview ||
      renderReminderText({
        reminder: r,
        booking,
        client: clientById.get(booking.clientId) ?? null,
        service: serviceById.get(booking.serviceId) ?? null,
        tech,
      })
    );
  };
  const clientName = (r: Reminder) => {
    const b = bookingById.get(r.bookingId);
    return (b && clientById.get(b.clientId)?.name) || "Client";
  };

  const scheduled = reminders.filter((r) => r.status === "scheduled");
  const sent = reminders.filter((r) => r.status === "sent").reverse();

  const rowEl = (r: Reminder, done?: boolean) => (
    <div key={r.id} className="rounded-xl border border-black/5 bg-cream px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {r.channel === "email" ? <Mail className="h-4 w-4 text-sky-600" /> : <MessageSquare className="h-4 w-4 text-violet-600" />}
          <span className="font-medium">{clientName(r)}</span>
          <Badge tone={r.channel === "email" ? "blue" : "purple"}>{labelForKind(r.kind)}</Badge>
        </div>
        <span className="text-xs text-ink-faint">{done ? "Sent" : "Sends"} {fmtDateTime(done && r.sentAtIso ? r.sentAtIso : r.sendAtIso)}</span>
      </div>
      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-ink-soft">{preview(r)}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reminders</h1>
          <p className="text-sm text-ink-soft">Confirmations, 24h nudges and balance requests. Sent automatically every 15 minutes by the scheduler.</p>
        </div>
        <form action={runRemindersAction}><Button type="submit" variant="secondary"><Play className="h-4 w-4" /> Run due now</Button></form>
      </div>

      {ran && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Processed any due reminders.</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-brand-600" /> Scheduled ({scheduled.length})</CardTitle>
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
