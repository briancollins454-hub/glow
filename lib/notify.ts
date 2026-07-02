import type { SupabaseClient } from "@supabase/supabase-js";
import { getBooking, getClient, getService, getTechById, markReminder } from "@/lib/db/queries";
import { fmtDateTime, gbp } from "@/lib/format";
import { sendEmail, brandedEmail } from "@/lib/email";
import type { Booking, Client, Reminder, ReminderKind, Service, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Ctx {
  reminder: Reminder;
  booking: Booking;
  client: Client | null;
  service: Service | null;
  tech: Tech | null;
}

export function renderReminderText({ reminder, booking, client, service, tech }: Ctx): string {
  const when = fmtDateTime(booking.startIso);
  const name = client?.name?.split(" ")[0] ?? "there";
  const biz = tech?.businessName ?? "your beauty studio";
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  switch (reminder.kind) {
    case "confirmation":
      return `Hi ${name}! Your ${svc} with ${biz} is booked for ${when}. Deposit of ${gbp(booking.depositPennies)} received — thank you. Balance due: ${gbp(booking.balancePennies)}.`;
    case "reminder_24h":
      return `Reminder: ${name}, your ${svc} with ${biz} is tomorrow (${when}). See you then! Need to rearrange? Please give notice.`;
    case "reminder_2h":
      return `Hi ${name}, just a quick reminder your ${svc} is in a couple of hours (${when}). ${biz}`;
    case "balance_request":
      return `Hi ${name}, your remaining balance of ${gbp(booking.balancePennies)} for your ${svc} can be paid here before your appointment: ${payUrl}`;
    default:
      return `Hi ${name}, a message about your booking with ${biz}.`;
  }
}

function subjectFor(kind: ReminderKind, biz: string): string {
  switch (kind) {
    case "confirmation":
      return `Your booking with ${biz} is confirmed`;
    case "reminder_24h":
      return `Reminder: your appointment tomorrow`;
    case "reminder_2h":
      return `See you soon — your appointment is in 2 hours`;
    case "balance_request":
      return `Your remaining balance for ${biz}`;
  }
}

function renderReminderEmail(ctx: Ctx): { subject: string; html: string } {
  const { reminder, booking, client, service, tech } = ctx;
  const brand = tech?.brandColor || "#db2777";
  const biz = tech?.businessName ?? "your beauty studio";
  const name = client?.name?.split(" ")[0] ?? "there";
  const when = fmtDateTime(booking.startIso);
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  let heading = "";
  let bodyHtml = "";
  let buttonLabel: string | undefined;
  let buttonUrl: string | undefined;

  switch (reminder.kind) {
    case "confirmation":
      heading = "You're booked in!";
      bodyHtml = `Hi ${name},<br/><br/>Your <strong>${svc}</strong> is confirmed for <strong>${when}</strong>.<br/><br/>Deposit paid: ${gbp(booking.depositPennies)}<br/>Balance due on the day: <strong>${gbp(booking.balancePennies)}</strong>`;
      if (booking.balancePennies > 0) {
        buttonLabel = "Pay balance early";
        buttonUrl = payUrl;
      }
      break;
    case "reminder_24h":
      heading = "See you tomorrow";
      bodyHtml = `Hi ${name},<br/><br/>Just a reminder that your <strong>${svc}</strong> is tomorrow, <strong>${when}</strong>. Looking forward to seeing you!`;
      break;
    case "reminder_2h":
      heading = "Almost time";
      bodyHtml = `Hi ${name},<br/><br/>Your <strong>${svc}</strong> is in about 2 hours (${when}). See you soon!`;
      break;
    case "balance_request":
      heading = "Your balance is ready to pay";
      bodyHtml = `Hi ${name},<br/><br/>Your remaining balance for <strong>${svc}</strong> is <strong>${gbp(booking.balancePennies)}</strong>. You can pay it securely before your appointment.`;
      buttonLabel = `Pay ${gbp(booking.balancePennies)}`;
      buttonUrl = payUrl;
      break;
  }

  return {
    subject: subjectFor(reminder.kind, biz),
    html: brandedEmail({ brand, businessName: biz, heading, bodyHtml, buttonLabel, buttonUrl }),
  };
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

/** Render + send a reminder email via Resend, then record it. */
export async function sendReminder(sb: SupabaseClient, reminder: Reminder): Promise<void> {
  const booking = await getBooking(sb, reminder.bookingId);
  if (!booking) return;
  const [client, service, tech] = await Promise.all([
    getClient(sb, booking.clientId),
    getService(sb, booking.serviceId),
    getTechById(sb, booking.techId),
  ]);
  const ctx: Ctx = { reminder, booking, client, service, tech };
  const text = renderReminderText(ctx);
  const { subject, html } = renderReminderEmail(ctx);

  if (client?.email) {
    await sendEmail({ to: client.email, subject, html, text });
  }

  await markReminder(sb, reminder.id, {
    status: "sent",
    sentAtIso: new Date().toISOString(),
    preview: text,
  });
}
