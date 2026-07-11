import { fmtDateTime, gbp } from "@/lib/format";
import type { Booking, Client, Reminder, ReminderKind, Service, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Ctx {
  reminder: Reminder;
  booking: Booking;
  client: Client | null;
  service: Service | null;
  tech: Tech | null;
}

/** Pure reminder preview text — safe for client components. */
export function renderReminderText({ reminder, booking, client, service, tech }: Ctx): string {
  const when = fmtDateTime(booking.startIso);
  const name = client?.name?.split(" ")[0] ?? "there";
  const biz = tech?.businessName ?? "your beauty studio";
  const svc = service?.name ?? "your appointment";
  const payUrl = `${APP_URL}/pay/${booking.balanceToken}`;

  switch (reminder.kind) {
    case "confirmation":
      return `Hi ${name}! Your ${svc} with ${biz} is booked for ${when}. Deposit of ${gbp(booking.depositPennies)} received - thank you. Balance due: ${gbp(booking.balancePennies)}.`;
    case "reminder_24h":
      return `Reminder: ${name}, your ${svc} with ${biz} is tomorrow (${when}). See you then! Need to rearrange? Please give notice.`;
    case "reminder_2h":
      return `Hi ${name}, just a quick reminder your ${svc} is in a couple of hours (${when}). ${biz}`;
    case "balance_request":
      return `Hi ${name}, your remaining balance of ${gbp(booking.balancePennies)} for your ${svc} can be paid here before your appointment: ${payUrl}`;
    case "patch_test_retest":
      return reminder.preview || `Hi ${name}, ${biz} needs you to arrange a patch test before your appointment.`;
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
    case "patch_test_retest":
      return "Patch test re-test";
  }
}
