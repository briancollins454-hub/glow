import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { getService, getTechById, listWaitlist, updateWaitlistEntry } from "@/lib/db/queries";
import { sendEmail, brandedEmail } from "@/lib/email";
import { salonTz } from "@/lib/locale";
import type { Booking, Client, WaitlistEntry } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const MAX_NOTIFY_PER_CANCELLATION = 10;

/**
 * A booking was cancelled: tell waiting clients a slot just opened up.
 * Notifies entries waiting for that specific date plus "any date" entries,
 * each at most once. Best-effort - callers wrap in try/catch.
 */
export async function notifyWaitlistForCancelledBooking(
  sb: SupabaseClient,
  booking: Booking,
): Promise<number> {
  const startMs = new Date(booking.startIso).getTime();
  if (startMs <= Date.now()) return 0;

  const tech = await getTechById(sb, booking.techId);
  if (!tech) return 0;
  const [entries, service] = await Promise.all([
    listWaitlist(sb, tech.id),
    getService(sb, booking.serviceId),
  ]);

  const dateStr = formatInTimeZone(new Date(booking.startIso), salonTz(tech), "yyyy-MM-dd");
  const waiting = entries
    .filter((e) => !e.notifiedAtIso && (e.dateStr === "" || e.dateStr === dateStr))
    .slice(0, MAX_NOTIFY_PER_CANCELLATION);

  const niceWhen = formatInTimeZone(new Date(booking.startIso), salonTz(tech), "EEEE d MMMM 'at' HH:mm");
  const biz = tech.businessName || "your beauty studio";
  const url = `${APP_URL}/${tech.handle}`;

  let notified = 0;
  for (const entry of waiting) {
    const name = entry.name?.split(" ")[0] || "there";
    const ok = await sendEmail({
      to: entry.email,
      subject: `A slot just opened up at ${biz}`,
      html: brandedEmail({
        brand: tech.brandColor || "#db2777",
        businessName: biz,
        heading: "A slot just opened up!",
        bodyHtml:
          `Hi ${name},<br/><br/>Good news - a ${service ? `<strong>${service.name}</strong> ` : ""}appointment on <strong>${niceWhen}</strong> has just become available at ${biz}.<br/><br/>` +
          `You asked us to let you know. Slots go fast - book now if you want it.`,
        buttonLabel: "Book the slot",
        buttonUrl: url,
      }),
      text: `Hi ${name}, a slot on ${niceWhen} just opened up at ${biz}. Book: ${url}`,
      idempotencyKey: `waitlist/${entry.id}/${booking.id}`,
      techId: tech.id,
      kind: "waitlist",
    });
    if (ok) {
      await updateWaitlistEntry(sb, entry.id, { notifiedAtIso: new Date().toISOString() });
      notified++;
    }
  }
  return notified;
}

/**
 * Did this booking's client previously get a "slot opened up" waitlist email?
 * Used to label the tech's push as a waitlist claim rather than a plain
 * booking. Matches on email (case-insensitive) or digits-only phone.
 */
export async function findNotifiedWaitlistMatch(
  sb: SupabaseClient,
  techId: string,
  client: Pick<Client, "email" | "phone">,
): Promise<WaitlistEntry | null> {
  const email = client.email?.trim().toLowerCase() ?? "";
  const phone = (client.phone ?? "").replace(/\D/g, "");
  if (!email && !phone) return null;
  const entries = await listWaitlist(sb, techId);
  return (
    entries.find((e) => {
      if (!e.notifiedAtIso) return false;
      if (email && e.email.trim().toLowerCase() === email) return true;
      if (phone && (e.phone ?? "").replace(/\D/g, "") === phone) return true;
      return false;
    }) ?? null
  );
}
