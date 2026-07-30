"use server";

import { getDashboardContext, invalidateDashboardTech } from "@/lib/auth/session";
import {
  deletePushSubscription,
  getTechById,
  listPushSubscriptions,
  updateTech,
  upsertPushSubscription,
} from "@/lib/db/queries";
import { handleLastSubscriptionGone, PUSH_KINDS, sendPushToTech } from "@/lib/push";
import {
  normalizePushSubscriptionPayload,
  pushEnableMessage,
  pushEndpointHost,
  type PushEnableFailureCode,
} from "@/lib/push-support";
import { isAdminTech } from "@/lib/admin";
import { supabaseService } from "@/lib/supabase/service";
import type { PushKind, PushPrefs } from "@/lib/db/types";

export type PushDevice = {
  id: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  failureCount: number;
  /** Push service host only — never the full endpoint URL. */
  endpointHost: string;
  /** True when this row belongs to the calling session's device. */
  mine: boolean;
};

export type SubscribePushResult =
  | { ok: true }
  | { ok: false; code: PushEnableFailureCode; error: string };

/**
 * Register (or refresh) this device's push subscription.
 * Accepts either the flat action shape or the browser's PushSubscriptionJSON
 * (`endpoint` + `keys.p256dh` / `keys.auth`).
 *
 * Uses the service client so a missing RLS policy cannot silently block the
 * save (migration 0065 adds the owner policy; this keeps subscribe working
 * either way). Every write is still scoped to the session techId.
 */
export async function subscribePushAction(input: {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
}): Promise<SubscribePushResult> {
  const c = await getDashboardContext();
  if (!c) {
    return { ok: false, code: "unauthorized", error: pushEnableMessage("unauthorized") };
  }
  const parsed = normalizePushSubscriptionPayload(input);
  if (!parsed.ok) {
    console.error("[push] subscribe rejected: invalid payload", {
      hasEndpoint: !!input.endpoint,
      hasP256dh: !!(input.p256dh || input.keys?.p256dh),
      hasAuth: !!(input.auth || input.keys?.auth),
    });
    return { ok: false, code: "invalid_payload", error: pushEnableMessage("invalid_payload") };
  }
  try {
    const sb = supabaseService();
    const row = await upsertPushSubscription(sb, {
      techId: c.tech.id,
      staffId: c.role === "staff" ? c.staff?.id ?? null : null,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent: String(input.userAgent ?? "").slice(0, 300),
    });
    console.info("[push] subscribe saved", {
      techId: c.tech.id,
      subId: row.id,
      host: pushEndpointHost(parsed.endpoint),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[push] subscribe failed", detail);
    return {
      ok: false,
      code: "save_failed",
      error: pushEnableMessage("save_failed", detail.slice(0, 120)),
    };
  }
  return { ok: true };
}

/** Remove a subscription — from the device list or the device itself. */
export async function unsubscribePushAction(input: {
  id?: string;
  endpoint?: string;
}): Promise<{ ok: boolean }> {
  const c = await getDashboardContext();
  if (!c) return { ok: false };
  const sb = supabaseService();
  const subs = await listPushSubscriptions(sb, c.tech.id).catch(() => []);
  const target = subs.find(
    (s) => (input.id && s.id === input.id) || (input.endpoint && s.endpoint === input.endpoint),
  );
  if (!target) return { ok: true };
  await deletePushSubscription(sb, target.id);
  await handleLastSubscriptionGone(sb, c.tech.id);
  return { ok: true };
}

/** Devices with push enabled for this salon (endpoint kept server-side). */
export async function listPushDevicesAction(input: {
  currentEndpoint?: string;
}): Promise<PushDevice[]> {
  const c = await getDashboardContext();
  if (!c) return [];
  try {
    const subs = await listPushSubscriptions(supabaseService(), c.tech.id);
    return subs.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      failureCount: s.failureCount,
      endpointHost: pushEndpointHost(s.endpoint),
      mine: !!input.currentEndpoint && s.endpoint === input.currentEndpoint,
    }));
  } catch (err) {
    console.error("[push] list devices failed", err);
    return [];
  }
}

/**
 * Fresh subscription count for the session tech. Used by the settings UI after
 * enable so the email toggle does not rely on the page's initial render.
 */
export async function countPushSubscriptionsAction(): Promise<number> {
  const c = await getDashboardContext();
  if (!c) return 0;
  try {
    const subs = await listPushSubscriptions(supabaseService(), c.tech.id);
    return subs.length;
  } catch {
    return 0;
  }
}

/** Save notification preferences (toggles, email supplement, quiet hours, summary time). */
export async function updatePushPrefsAction(input: {
  kinds?: Partial<Record<string, boolean>>;
  emailAlso?: boolean;
  quietHoursEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
  dailySummaryTime?: string;
}): Promise<{ ok: boolean; error?: string; subscriptionCount?: number }> {
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

  // Always re-read subscriptions here — never trust client/page-initial state.
  // Enable and prefs save are separate requests; the gate must see a row that
  // was just committed in this same session.
  const sb = supabaseService();
  const subs = await listPushSubscriptions(sb, c.tech.id).catch(() => []);
  const subscriptionCount = subs.length;

  let emailAlso = input.emailAlso !== false;
  if (!emailAlso) {
    if (subscriptionCount === 0) {
      return {
        ok: false,
        error: "Enable push notifications on at least one device before turning email off.",
        subscriptionCount: 0,
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

  await updateTech(sb, c.tech.id, { pushPrefs: prefs });
  invalidateDashboardTech(c.tech.authUserId);
  return { ok: true, subscriptionCount };
}

/** Send a test push to every device registered for the session tech (salon owner). */
export async function sendTestPushAction(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const c = await getDashboardContext();
  if (!c) return { ok: false, sent: 0, error: "Please sign in again." };
  if (c.role !== "owner") {
    return { ok: false, sent: 0, error: "Only the salon owner can send a test notification." };
  }
  const sb = supabaseService();
  const sent = await sendPushToTech(
    sb,
    c.tech,
    "new_booking",
    {
      title: "Test notification",
      body: "Glow push is working on this device.",
      url: "/dashboard/settings",
      tag: "glow-push-test",
    },
    { urgent: true },
  );
  return sent > 0
    ? { ok: true, sent }
    : { ok: false, sent: 0, error: "No devices received the test. Enable push on a device first." };
}

/** Platform-owner diagnostics: list subscriptions for any tech. */
export async function ownerListPushSubscriptionsAction(techId: string): Promise<
  Array<{
    id: string;
    userAgent: string;
    endpointHost: string;
    lastSeenAt: string;
    failureCount: number;
    createdAt: string;
    staffId: string | null;
  }>
> {
  const c = await getDashboardContext();
  if (!c || c.role !== "owner" || !isAdminTech(c.tech)) return [];
  const id = String(techId ?? "").trim();
  if (!id) return [];
  try {
    const subs = await listPushSubscriptions(supabaseService(), id);
    return subs.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      endpointHost: pushEndpointHost(s.endpoint),
      lastSeenAt: s.lastSeenAt,
      failureCount: s.failureCount,
      createdAt: s.createdAt,
      staffId: s.staffId,
    }));
  } catch (err) {
    console.error("[push] owner list failed", err);
    return [];
  }
}

/** Platform-owner: send a test push to a tech's devices. */
export async function ownerSendTestPushAction(
  techId: string,
): Promise<{ ok: boolean; sent: number; error?: string }> {
  const c = await getDashboardContext();
  if (!c || c.role !== "owner" || !isAdminTech(c.tech)) {
    return { ok: false, sent: 0, error: "Not allowed." };
  }
  const id = String(techId ?? "").trim();
  if (!id) return { ok: false, sent: 0, error: "Missing tech." };
  const sb = supabaseService();
  const tech = await getTechById(sb, id);
  if (!tech) return { ok: false, sent: 0, error: "Account not found." };
  const sent = await sendPushToTech(
    sb,
    tech,
    "new_booking",
    {
      title: "Test notification",
      body: "Glow push diagnostic from the owner console.",
      url: "/dashboard/settings",
      tag: "glow-push-test-owner",
    },
    { urgent: true },
  );
  return sent > 0
    ? { ok: true, sent }
    : { ok: false, sent: 0, error: "No devices received the test (none registered or all failed)." };
}
