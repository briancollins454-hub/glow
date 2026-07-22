import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listLiveTechs,
  listRebookNudgeBookings,
  listRebookNudgeClients,
  listServices,
  updateClient,
  type RebookNudgeBooking,
  type RebookNudgeClient,
} from "@/lib/db/queries";
import { sendEmail, brandedEmail, isValidEmail } from "@/lib/email";
import type { Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DAY = 24 * 60 * 60 * 1000;

// A client is "lapsed" when their last visit is 30-120 days old with nothing
// booked ahead. One nudge per client per 60 days; capped per cron run so a
// big backlog can't blow the email quota in one go.
export const REBOOK_MIN_GAP_DAYS = 30;
export const REBOOK_MAX_GAP_DAYS = 120;
export const REBOOK_NUDGE_COOLDOWN_DAYS = 60;
/** How far ahead we look for an upcoming booking that should suppress a nudge. */
export const REBOOK_UPCOMING_HORIZON_DAYS = 60;
const MAX_PER_RUN = 25;

export type RebookNudgeCandidate = {
  client: RebookNudgeClient;
  lastServiceId: string;
};

/** Date window the cron loads from bookings (120d back → 60d ahead). */
export function rebookNudgeBookingWindow(nowMs: number): { fromIso: string; toIso: string } {
  return {
    fromIso: new Date(nowMs - REBOOK_MAX_GAP_DAYS * DAY).toISOString(),
    toIso: new Date(nowMs + REBOOK_UPCOMING_HORIZON_DAYS * DAY).toISOString(),
  };
}

export function lastCompletedVisit(
  bookings: RebookNudgeBooking[],
  clientId: string,
): RebookNudgeBooking | null {
  return (
    bookings
      .filter((b) => b.clientId === clientId && b.status === "completed")
      .sort((a, z) => new Date(z.startIso).getTime() - new Date(a.startIso).getTime())[0] ?? null
  );
}

export function hasUpcomingBooking(
  bookings: RebookNudgeBooking[],
  clientId: string,
  nowMs: number,
): boolean {
  return bookings.some(
    (b) =>
      b.clientId === clientId &&
      new Date(b.startIso).getTime() > nowMs &&
      (b.status === "confirmed" || b.status === "pending"),
  );
}

/**
 * Pure candidate selection shared by the cron and tests. Applies the same
 * lapse / cooldown / upcoming rules as before; callers may pre-filter in SQL.
 */
export function selectRebookNudgeCandidates(
  clients: RebookNudgeClient[],
  bookings: RebookNudgeBooking[],
  nowMs: number,
): RebookNudgeCandidate[] {
  const out: RebookNudgeCandidate[] = [];
  for (const client of clients) {
    // messageToken is required for the unsubscribe link - no token, no marketing.
    if (
      !client.email ||
      !isValidEmail(client.email) ||
      !client.messageToken ||
      client.isBlacklisted ||
      client.marketingOptOut
    ) {
      continue;
    }

    const lastNudge = client.lastNudgeAtIso ? new Date(client.lastNudgeAtIso).getTime() : 0;
    if (nowMs - lastNudge < REBOOK_NUDGE_COOLDOWN_DAYS * DAY) continue;

    const last = lastCompletedVisit(bookings, client.id);
    if (!last) continue;
    const gap = nowMs - new Date(last.startIso).getTime();
    if (gap < REBOOK_MIN_GAP_DAYS * DAY || gap > REBOOK_MAX_GAP_DAYS * DAY) continue;
    if (hasUpcomingBooking(bookings, client.id, nowMs)) continue;

    out.push({ client, lastServiceId: last.serviceId });
  }
  return out;
}

async function sendNudge(
  tech: Tech,
  client: RebookNudgeClient,
  lastServiceName: string,
): Promise<boolean> {
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
  const { fromIso, toIso } = rebookNudgeBookingWindow(now);
  const cooldownBeforeIso = new Date(now - REBOOK_NUDGE_COOLDOWN_DAYS * DAY).toISOString();

  const techs = await listLiveTechs(sb);
  for (const tech of techs) {
    if (sent >= MAX_PER_RUN) break;
    if (!tech.rebookNudgesEnabled) continue;

    const [clients, bookings, services] = await Promise.all([
      listRebookNudgeClients(sb, tech.id, cooldownBeforeIso),
      listRebookNudgeBookings(sb, tech.id, fromIso, toIso),
      listServices(sb, tech.id),
    ]);
    const serviceName = new Map(services.map((s) => [s.id, s.name]));
    const candidates = selectRebookNudgeCandidates(clients, bookings, now);

    for (const { client, lastServiceId } of candidates) {
      if (sent >= MAX_PER_RUN) break;

      const ok = await sendNudge(tech, client, serviceName.get(lastServiceId) ?? "");
      // Stamp even on failure so a dead/invalid address is not retried every cron run.
      await updateClient(sb, client.id, { lastNudgeAtIso: new Date(now).toISOString() });
      if (ok) {
        sent++;
      }
    }
  }
  return sent;
}
