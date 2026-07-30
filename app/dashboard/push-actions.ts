"use server";

import { getDashboardContext, invalidateDashboardTech } from "@/lib/auth/session";
import {
  deletePushSubscription,
  listPushSubscriptions,
  updateTech,
  upsertPushSubscription,
} from "@/lib/db/queries";
import { handleLastSubscriptionGone, PUSH_KINDS } from "@/lib/push";
import type { PushKind, PushPrefs } from "@/lib/db/types";

export type PushDevice = {
  id: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  /** True when this row belongs to the calling session's device. */
  mine: boolean;
};

/** Register (or refresh) this device's push subscription. */
export async function subscribePushAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean }> {
  const c = await getDashboardContext();
  if (!c) return { ok: false };
  const endpoint = String(input.endpoint ?? "").trim();
  const p256dh = String(input.p256dh ?? "").trim();
  const auth = String(input.auth ?? "").trim();
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false };
  await upsertPushSubscription(c.sb, {
    techId: c.tech.id,
    staffId: c.role === "staff" ? c.staff?.id ?? null : null,
    endpoint,
    p256dh,
    auth,
    userAgent: String(input.userAgent ?? "").slice(0, 300),
  });
  return { ok: true };
}

/** Remove a subscription — from the device list or the device itself. */
export async function unsubscribePushAction(input: {
  id?: string;
  endpoint?: string;
}): Promise<{ ok: boolean }> {
  const c = await getDashboardContext();
  if (!c) return { ok: false };
  const subs = await listPushSubscriptions(c.sb, c.tech.id);
  const target = subs.find(
    (s) => (input.id && s.id === input.id) || (input.endpoint && s.endpoint === input.endpoint),
  );
  if (!target) return { ok: true };
  await deletePushSubscription(c.sb, target.id);
  await handleLastSubscriptionGone(c.sb, c.tech.id);
  return { ok: true };
}

/** Devices with push enabled for this salon (endpoint kept server-side). */
export async function listPushDevicesAction(input: {
  currentEndpoint?: string;
}): Promise<PushDevice[]> {
  const c = await getDashboardContext();
  if (!c) return [];
  const subs = await listPushSubscriptions(c.sb, c.tech.id);
  return subs.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    mine: !!input.currentEndpoint && s.endpoint === input.currentEndpoint,
  }));
}

/** Save notification preferences (toggles, email supplement, quiet hours, summary time). */
export async function updatePushPrefsAction(input: {
  kinds?: Partial<Record<string, boolean>>;
  emailAlso?: boolean;
  quietHoursEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
  dailySummaryTime?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const c = await getDashboardContext();
  if (!c) return { ok: false, error: "Please sign in again." };

  const hhmm = (v: unknown, fallback: string): string => {
    const s = String(v ?? "").trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fallback;
  };

  const kinds: Partial<Record<PushKind, boolean>> = {};
  for (const kind of PUSH_KINDS) {
    const v = input.kinds?.[kind];
    if (typeof v === "boolean") kinds[kind] = v;
  }

  // Email may only be switched off while at least one device can receive push.
  let emailAlso = input.emailAlso !== false;
  if (!emailAlso) {
    const subs = await listPushSubscriptions(c.sb, c.tech.id);
    if (subs.length === 0) {
      return {
        ok: false,
        error: "Enable push notifications on at least one device before turning email off.",
      };
    }
  }

  const prefs: PushPrefs = {
    kinds,
    emailAlso,
    quietHoursEnabled: input.quietHoursEnabled === true,
    quietStart: hhmm(input.quietStart, "21:00"),
    quietEnd: hhmm(input.quietEnd, "08:00"),
    dailySummaryTime: hhmm(input.dailySummaryTime, "08:00"),
  };

  await updateTech(c.sb, c.tech.id, { pushPrefs: prefs });
  invalidateDashboardTech(c.tech.authUserId);
  return { ok: true };
}
