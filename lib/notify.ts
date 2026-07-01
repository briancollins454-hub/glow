import type { SupabaseClient } from "@supabase/supabase-js";
import { getBooking, getClient, getService, getTechById, markReminder } from "@/lib/db/queries";
import { fmtDateTime, gbp } from "@/lib/format";
import type { Booking, Client, Reminder, ReminderKind, Service, Tech } from "@/lib/db/types";

// Stubbed notification service. Swap for Resend (email) + Twilio (SMS) in Phase D.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function renderReminderText(input: {
  reminder: Reminder;
  booking: Booking;
  client: Client | null;
  service: Service | null;
  tech: Tech | null;
}): string {
  const { reminder, booking, client, service, tech } = input;
  const when = fmtDateTime(booking.startIso);
  const name = client?.name?.split(" ")[0] ?? "there";
  const biz = tech?.businessName ?? "your beauty studio";
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  switch (reminder.kind) {
    case "confirmation":
      return `Hi ${name}! Your ${svc} with ${biz} is booked for ${when}. Deposit of ${gbp(booking.depositPennies)} received — thank you. Balance due: ${gbp(booking.balancePennies)}.`;
    case "reminder_24h":
      return `Reminder: ${name}, your ${svc} with ${biz} is tomorrow (${when}). See you then! Need to rearrange? Please give 48h notice.`;
    case "reminder_2h":
      return `Hi ${name}, just a quick reminder your ${svc} is in a couple of hours (${when}). ${biz}`;
    case "balance_request":
      return `Hi ${name}, your remaining balance of ${gbp(booking.balancePennies)} for your ${svc} can be paid here before your appointment: ${payUrl}`;
    default:
      return `Hi ${name}, a message about your booking with ${biz}.`;
  }
}

export function labelForKind(kind: ReminderKind): string {
  switch (kind) {
    case "confirmation":
      return "Booking confirmation";
    case "reminder_24h":
      return "24-hour reminder";
    case "reminder_2h":
      return "2-hour reminder";
    case "balance_request":
      return "Balance request";
  }
}

/** Render + "send" a reminder (stub): stores the preview and marks it sent. */
export async function sendReminder(sb: SupabaseClient, reminder: Reminder): Promise<void> {
  const booking = await getBooking(sb, reminder.bookingId);
  if (!booking) return;
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  const preview = renderReminderText({ reminder, booking, client, service, tech });
  await markReminder(sb, reminder.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
    preview,
  });
}
