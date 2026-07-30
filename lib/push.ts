/**
 * Web Push (VAPID) for tech-facing notifications. Push supplements email by
 * default and must never break the operation that triggered it — every send
 * path is wrapped and failures only log.
 *
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY (client + server), VAPID_PRIVATE_KEY
 * (server only). Without both, everything here no-ops gracefully.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  createPushQueueItem,
  deletePushQueueItem,
  deletePushSubscription,
  duePushQueueItems,
  getTechById,
  listPushSubscriptions,
  listPushSubscriptionTechIds,
  updatePushSubscription,
  updateTech,
} from "@/lib/db/queries";
import { salonTz } from "@/lib/locale";
import type { PushKind, PushPrefs, PushSubscriptionRow, Tech } from "@/lib/db/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Delete a subscription after this many consecutive non-410 failures. */
export const PUSH_MAX_FAILURES = 5;

export type PushPayload = {
  title: string;
  body: string;
  /** Dashboard path (or absolute URL) opened on notification tap. */
  url: string;
  /** Collapse key so repeat sends replace rather than stack. */
  tag?: string;
};

export const PUSH_KIND_LABELS: Record<PushKind, string> = {
  new_booking: "New booking",
  booking_cancelled: "Booking cancelled by client",
  booking_rescheduled: "Booking rescheduled by client",
  payment_received: "Client paid a deposit or balance",
  form_completed: "Consultation form or signed consent completed",
  waitlist_claimed: "Waitlist client claimed a freed slot",
  daily_summary: "Daily summary",
};

export const PUSH_KINDS = Object.keys(PUSH_KIND_LABELS) as PushKind[];

export function webPushConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

// ---------------- Preferences ----------------

/** Whether this notification type is enabled for the tech (missing = on). */
export function pushKindEnabled(
  prefs: PushPrefs | null | undefined,
  kind: PushKind,
): boolean {
  return prefs?.kinds?.[kind] !== false;
}

/** "Also send these by email" — default on. */
export function pushEmailAlso(prefs: PushPrefs | null | undefined): boolean {
  return prefs?.emailAlso !== false;
}

export function dailySummaryTime(prefs: PushPrefs | null | undefined): string {
  const t = (prefs?.dailySummaryTime ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "08:00";
}

/**
 * Whether an instant falls inside the tech's quiet hours (salon-local).
 * Supports overnight windows (e.g. 21:00 → 08:00). Default off.
 */
export function inQuietHours(
  prefs: PushPrefs | null | undefined,
  tz: string,
  nowMs = Date.now(),
): boolean {
  if (!prefs?.quietHoursEnabled) return false;
  const start = prefs.quietStart ?? "21:00";
  const end = prefs.quietEnd ?? "08:00";
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return false;
  const now = formatInTimeZone(new Date(nowMs), tz, "HH:mm");
  // Overnight window wraps midnight; same-day window doesn't.
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Instant the current quiet period ends (only call when inQuietHours is true). */
export function quietHoursEndInstant(
  prefs: PushPrefs | null | undefined,
  tz: string,
  nowMs = Date.now(),
): Date {
  const end = prefs?.quietEnd ?? "08:00";
  const today = formatInTimeZone(new Date(nowMs), tz, "yyyy-MM-dd");
  let endInstant = fromZonedTime(`${today}T${end}:00`, tz);
  if (endInstant.getTime() <= nowMs) {
    // End time already passed today → the window ends tomorrow.
    const tomorrow = formatInTimeZone(
      new Date(nowMs + 24 * 60 * 60 * 1000),
      tz,
      "yyyy-MM-dd",
    );
    endInstant = fromZonedTime(`${tomorrow}T${end}:00`, tz);
  }
  return endInstant;
}

/**
 * Tech-facing emails may be suppressed only while at least one push
 * subscription is alive AND the tech turned "also send by email" off.
 * Client-facing emails are never affected by this.
 */
export async function techEmailSuppressed(sb: SupabaseClient, tech: Tech): Promise<boolean> {
  if (pushEmailAlso(tech.pushPrefs)) return false;
  if (!webPushConfigured()) return false;
  try {
    const subs = await listPushSubscriptions(sb, tech.id);
    return subs.length > 0;
  } catch {
    // Fail open: better a duplicate email than silence.
    return false;
  }
}

/**
 * The last subscription for a tech died (removed or failed permanently).
 * If they had switched email off, flip it back on and tell them — a tech must
 * never end up receiving nothing.
 */
export async function handleLastSubscriptionGone(
  sb: SupabaseClient,
  techId: string,
): Promise<void> {
  try {
    const remaining = await listPushSubscriptions(sb, techId);
    if (remaining.length > 0) return;
    const tech = await getTechById(sb, techId);
    if (!tech || pushEmailAlso(tech.pushPrefs)) return;
    await updateTech(sb, tech.id, {
      pushPrefs: { ...(tech.pushPrefs ?? {}), emailAlso: true },
    });
    const { sendEmail, brandedEmail } = await import("@/lib/email");
    await sendEmail({
      to: tech.email,
      subject: "Email notifications switched back on",
      html: brandedEmail({
        brand: tech.brandColor || "#db2777",
        businessName: tech.businessName || "Glow",
        heading: "Email notifications re-enabled",
        bodyHtml:
          "Push notifications stopped working on your last enabled device, so we've switched booking emails back on. " +
          "You can re-enable push from Settings → Notifications on your phone.",
        buttonLabel: "Open notification settings",
        buttonUrl: `${APP_URL}/dashboard/settings`,
      }),
      text:
        "Push notifications stopped working on your last enabled device, so booking emails are back on. " +
        `Re-enable push from ${APP_URL}/dashboard/settings.`,
      idempotencyKey: `push-email-revert/${techId}/${new Date().toISOString().slice(0, 10)}`,
      techId,
      kind: "push_email_revert",
    });
  } catch (err) {
    console.error("[push] email re-enable failed", err);
  }
}

// ---------------- Sending ----------------

async function sendToSubscription(
  sb: SupabaseClient,
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<boolean> {
  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "support@glow-uk.com"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const url = payload.url.startsWith("http") ? payload.url : `${APP_URL}${payload.url}`;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ ...payload, url }),
      { TTL: 60 * 60 * 12 },
    );
    if (sub.failureCount > 0) {
      await updatePushSubscription(sb, sub.id, {
        failureCount: 0,
        lastSeenAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 0;
    if (status === 404 || status === 410) {
      // The browser revoked this subscription — remove it.
      await deletePushSubscription(sb, sub.id).catch(() => undefined);
      await handleLastSubscriptionGone(sb, sub.techId);
      return false;
    }
    const failures = sub.failureCount + 1;
    if (failures >= PUSH_MAX_FAILURES) {
      await deletePushSubscription(sb, sub.id).catch(() => undefined);
      await handleLastSubscriptionGone(sb, sub.techId);
    } else {
      await updatePushSubscription(sb, sub.id, { failureCount: failures }).catch(() => undefined);
    }
    console.error("[push] send failed", status, (err as Error).message);
    return false;
  }
}

/**
 * Send a push of the given kind to a tech's devices. Never throws.
 * - Respects the per-type toggle.
 * - Respects quiet hours (queued until they end) unless `urgent`.
 * - Owner devices (staffId null) get everything; staff devices only get
 *   notifications for their own bookings (or untargeted ones).
 */
export async function sendPushToTech(
  sb: SupabaseClient,
  tech: Tech,
  kind: PushKind,
  payload: PushPayload,
  opts: { staffId?: string | null; urgent?: boolean } = {},
): Promise<number> {
  try {
    if (!webPushConfigured()) return 0;
    if (!pushKindEnabled(tech.pushPrefs, kind)) return 0;

    const tz = salonTz(tech);
    if (!opts.urgent && inQuietHours(tech.pushPrefs, tz)) {
      await createPushQueueItem(sb, {
        techId: tech.id,
        staffId: opts.staffId ?? null,
        payload,
        sendAfterIso: quietHoursEndInstant(tech.pushPrefs, tz).toISOString(),
      });
      return 0;
    }

    return await deliverToDevices(sb, tech.id, payload, opts.staffId ?? null);
  } catch (err) {
    // Push must never break the triggering operation.
    console.error("[push] sendPushToTech failed", err);
    return 0;
  }
}

async function deliverToDevices(
  sb: SupabaseClient,
  techId: string,
  payload: PushPayload,
  staffId: string | null,
): Promise<number> {
  const subs = await listPushSubscriptions(sb, techId);
  const targets = subs.filter((s) => !s.staffId || !staffId || s.staffId === staffId);
  let sent = 0;
  for (const sub of targets) {
    if (await sendToSubscription(sb, sub, payload)) sent++;
  }
  return sent;
}

/** Drain quiet-hours queue (reminders cron, every 15 min). Never throws. */
export async function processPushQueue(sb: SupabaseClient): Promise<number> {
  if (!webPushConfigured()) return 0;
  let sent = 0;
  try {
    const due = await duePushQueueItems(sb, new Date().toISOString());
    for (const item of due) {
      try {
        sent += await deliverToDevices(sb, item.techId, item.payload, item.staffId);
      } catch (err) {
        console.error("[push] queue delivery failed", err);
      }
      await deletePushQueueItem(sb, item.id).catch(() => undefined);
    }
  } catch (err) {
    console.error("[push] queue processing failed", err);
  }
  return sent;
}

/** Convenience trigger: a client completed a consultation form / signed consent. */
export async function sendFormCompletedPush(
  sb: SupabaseClient,
  tech: Tech,
  client: { name: string },
  bookingId: string,
  opts: { signedConsent: boolean; staffId?: string | null },
): Promise<void> {
  await sendPushToTech(
    sb,
    tech,
    "form_completed",
    {
      title: `${opts.signedConsent ? "Consent signed" : "Consultation form"} · ${client.name}`,
      body: opts.signedConsent
        ? "Signed consent and consultation answers are on file."
        : "Consultation answers are on file.",
      url: `/dashboard/bookings/${bookingId}`,
      tag: `form-${bookingId}`,
    },
    { staffId: opts.staffId ?? null },
  );
}

// ---------------- Daily summary ----------------

/**
 * Send the daily summary push to techs whose configured salon-local time has
 * passed and who haven't had one today. Runs from the reminders cron. Never throws.
 */
export async function processDailySummaryPushes(
  sb: SupabaseClient,
  nowMs = Date.now(),
): Promise<number> {
  if (!webPushConfigured()) return 0;
  let sent = 0;
  try {
    const techIds = await listPushSubscriptionTechIds(sb);
    for (const techId of techIds) {
      try {
        const tech = await getTechById(sb, techId);
        if (!tech) continue;
        if (!pushKindEnabled(tech.pushPrefs, "daily_summary")) continue;
        const tz = salonTz(tech);
        const today = formatInTimeZone(new Date(nowMs), tz, "yyyy-MM-dd");
        if (tech.pushDailySummaryLastDate === today) continue;
        const localTime = formatInTimeZone(new Date(nowMs), tz, "HH:mm");
        if (localTime < dailySummaryTime(tech.pushPrefs)) continue;

        const { listBookingsInWindow } = await import("@/lib/db/queries");
        const dayStart = fromZonedTime(`${today}T00:00:00`, tz).toISOString();
        const dayEnd = fromZonedTime(`${today}T23:59:59`, tz).toISOString();
        const bookings = (await listBookingsInWindow(sb, tech.id, dayStart, dayEnd))
          .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
          .sort((a, b) => a.startIso.localeCompare(b.startIso));

        const count = bookings.length;
        const first = bookings[0];
        const body =
          count === 0
            ? "No appointments today."
            : `${count} appointment${count === 1 ? "" : "s"} today · first at ${formatInTimeZone(new Date(first!.startIso), tz, "HH:mm")}`;

        // Mark before sending so a crashed run can't double-send.
        await updateTech(sb, tech.id, { pushDailySummaryLastDate: today });
        sent += await deliverToDevices(
          sb,
          tech.id,
          {
            title: "Today at a glance",
            body,
            url: "/dashboard/bookings",
            tag: `daily-summary-${today}`,
          },
          null,
        );
      } catch (err) {
        console.error("[push] daily summary failed for tech", techId, err);
      }
    }
  } catch (err) {
    console.error("[push] daily summary sweep failed", err);
  }
  return sent;
}
