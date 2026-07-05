import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listBookings,
  listClients,
  listLiveTechs,
  listServices,
  updateClient,
} from "@/lib/db/queries";
import { sendEmail, brandedEmail } from "@/lib/email";
import type { Booking, Client, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DAY = 24 * 60 * 60 * 1000;

// A client is "lapsed" when their last visit is 30-120 days old with nothing
// booked ahead. One nudge per client per 60 days; capped per cron run so a
// big backlog can't blow the email quota in one go.
const MIN_GAP_DAYS = 30;
const MAX_GAP_DAYS = 120;
const NUDGE_COOLDOWN_DAYS = 60;
const MAX_PER_RUN = 25;

function lastCompletedVisit(bookings: Booking[], clientId: string): Booking | null {
  return (
    bookings
      .filter((b) => b.clientId === clientId && b.status === "completed")
      .sort((a, z) => new Date(z.startIso).getTime() - new Date(a.startIso).getTime())[0] ?? null
  );
}

function hasUpcomingBooking(bookings: Booking[], clientId: string, now: number): boolean {
  return bookings.some(
    (b) =>
      b.clientId === clientId &&
      new Date(b.startIso).getTime() > now &&
      (b.status === "confirmed" || b.status === "pending"),
  );
}

async function sendNudge(tech: Tech, client: Client, lastServiceName: string): Promise<boolean> {
  const biz = tech.businessName || "your beauty studio";
  const name = client.name?.split(" ")[0] ?? "there";
  const url = `${APP_URL}/${tech.handle}`;
  // PECR: marketing emails must carry a working opt-out.
  const unsubUrl = `${APP_URL}/unsubscribe/${client.messageToken}`;
  const html = brandedEmail({
    brand: tech.brandColor || "#db2777",
    businessName: biz,
    heading: "Time for your next appointment?",
    bodyHtml:
      `Hi ${name},<br/><br/>It's been a little while since your last ${lastServiceName ? `<strong>${lastServiceName}</strong>` : "visit"} at ${biz}. ` +
      `Slots fill up fast - grab your favourite time before it goes.` +
      `<br/><br/><span style="font-size:12px;color:#8a7f91">Don't want these reminders? <a href="${unsubUrl}" style="color:#8a7f91">Unsubscribe here</a>. You'll still get confirmations for appointments you book.</span>`,
    buttonLabel: "Book now",
    buttonUrl: url,
  });
  return sendEmail({
    to: client.email,
    subject: `We miss you at ${biz}!`,
    html,
    text: `Hi ${name}, it's been a while since your last visit at ${biz}. Book your next appointment: ${url}\n\nUnsubscribe from these emails: ${unsubUrl}`,
    idempotencyKey: `rebook-nudge/${client.id}/${new Date().toISOString().slice(0, 10)}`,
  });
}

/** Cron entry point: send "come back" emails to lapsed clients of live techs. */
export async function processRebookNudges(sb: SupabaseClient): Promise<number> {
  const now = Date.now();
  let sent = 0;

  const techs = await listLiveTechs(sb);
  for (const tech of techs) {
    if (sent >= MAX_PER_RUN) break;
    if (!tech.rebookNudgesEnabled) continue;

    const [clients, bookings, services] = await Promise.all([
      listClients(sb, tech.id),
      listBookings(sb, tech.id),
      listServices(sb, tech.id),
    ]);
    const serviceName = new Map(services.map((s) => [s.id, s.name]));

    for (const client of clients) {
      if (sent >= MAX_PER_RUN) break;
      // messageToken is required for the unsubscribe link - no token, no marketing.
      if (!client.email || !client.messageToken || client.isBlacklisted || client.marketingOptOut) continue;

      const lastNudge = client.lastNudgeAtIso ? new Date(client.lastNudgeAtIso).getTime() : 0;
      if (now - lastNudge < NUDGE_COOLDOWN_DAYS * DAY) continue;

      const last = lastCompletedVisit(bookings, client.id);
      if (!last) continue;
      const gap = now - new Date(last.startIso).getTime();
      if (gap < MIN_GAP_DAYS * DAY || gap > MAX_GAP_DAYS * DAY) continue;
      if (hasUpcomingBooking(bookings, client.id, now)) continue;

      const ok = await sendNudge(tech, client, serviceName.get(last.serviceId) ?? "");
      if (ok) {
        await updateClient(sb, client.id, { lastNudgeAtIso: new Date(now).toISOString() });
        sent++;
      }
    }
  }
  return sent;
}
