import { redirect } from "next/navigation";
import { BellRing, Mail, MessageSquare, Play, CheckCircle2 } from "lucide-react";
import { getCurrentTech } from "@/lib/auth/session";
import { getBooking, getClient, listReminders } from "@/lib/db/repo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";
import { renderReminder, labelForKind } from "@/lib/notify";
import { runRemindersAction } from "../actions";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string }>;
}) {
  const tech = await getCurrentTech();
  if (!tech) redirect("/login");
  const { ran } = await searchParams;
  const reminders = listReminders(tech.id);

  const scheduled = reminders.filter((r) => r.status === "scheduled");
  const sent = reminders.filter((r) => r.status === "sent").reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reminders</h1>
          <p className="text-sm text-ink-soft">
            Confirmations, 24h nudges and balance requests. Sent automatically every
            15 minutes by the scheduler.
          </p>
        </div>
        <form action={runRemindersAction}>
          <Button type="submit" variant="secondary">
            <Play className="h-4 w-4" /> Run due now
          </Button>
        </form>
      </div>

      {ran && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Processed any due reminders.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-brand-600" /> Scheduled ({scheduled.length})
          </CardTitle>
          <CardDescription>Waiting to send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {scheduled.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">Nothing scheduled.</p>
          )}
          {scheduled.map((r) => (
            <ReminderRow key={r.id} reminder={r} clientName={clientNameFor(r.bookingId)} preview={renderReminder(r)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent ({sent.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sent.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">Nothing sent yet.</p>
          )}
          {sent.slice(0, 30).map((r) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              clientName={clientNameFor(r.bookingId)}
              preview={r.preview || renderReminder(r)}
              done
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );

  function clientNameFor(bookingId: string): string {
    const b = getBooking(bookingId);
    return (b && getClient(b.clientId)?.name) || "Client";
  }
}

function ReminderRow({
  reminder,
  clientName,
  preview,
  done,
}: {
  reminder: ReturnType<typeof listReminders>[number];
  clientName: string;
  preview: string;
  done?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-cream px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {reminder.channel === "email" ? (
            <Mail className="h-4 w-4 text-sky-600" />
          ) : (
            <MessageSquare className="h-4 w-4 text-violet-600" />
          )}
          <span className="font-medium">{clientName}</span>
          <Badge tone={reminder.channel === "email" ? "blue" : "purple"}>
            {labelForKind(reminder.kind)}
          </Badge>
        </div>
        <span className="text-xs text-ink-faint">
          {done ? "Sent" : "Sends"} {fmtDateTime(done && reminder.sentAtIso ? reminder.sentAtIso : reminder.sendAtIso)}
        </span>
      </div>
      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-ink-soft">{preview}</p>
    </div>
  );
}
