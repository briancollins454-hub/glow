/**
 * Subscribe / prefs-save actions: upsert behaviour and same-session email gate.
 * Isolated from push.test.ts so we can mock session + queries for the actions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTech } from "./fixtures";
import type { PushSubscriptionRow } from "@/lib/db/types";

const tech = makeTech({ id: "tech_gate_1" });
const rows: PushSubscriptionRow[] = [];
const upserts: Array<Record<string, unknown>> = [];
const techPatches: Array<Record<string, unknown>> = [];

vi.mock("@/lib/auth/session", () => ({
  getDashboardContext: async () => ({
    sb: {},
    tech,
    staff: null,
    role: "owner" as const,
  }),
  invalidateDashboardTech: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({}),
}));

vi.mock("@/lib/admin", () => ({
  isAdminTech: () => false,
  isPlatformOwner: () => false,
}));

vi.mock("@/lib/db/queries", () => ({
  listPushSubscriptions: async (_sb: unknown, techId: string) =>
    rows.filter((r) => r.techId === techId),
  upsertPushSubscription: async (
    _sb: unknown,
    sub: Omit<PushSubscriptionRow, "id" | "createdAt" | "lastSeenAt" | "failureCount">,
  ) => {
    upserts.push(sub);
    const existing = rows.find((r) => r.endpoint === sub.endpoint);
    if (existing) {
      Object.assign(existing, {
        ...sub,
        lastSeenAt: new Date().toISOString(),
        failureCount: 0,
      });
      return existing;
    }
    const row: PushSubscriptionRow = {
      ...sub,
      id: `psub_${rows.length + 1}`,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      failureCount: 0,
    };
    rows.push(row);
    return row;
  },
  deletePushSubscription: async (_sb: unknown, id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
  },
  updateTech: async (_sb: unknown, _id: string, patch: Record<string, unknown>) => {
    techPatches.push(patch);
  },
  getTechById: async () => tech,
}));

import {
  subscribePushAction,
  updatePushPrefsAction,
} from "@/app/dashboard/push-actions";

beforeEach(() => {
  rows.length = 0;
  upserts.length = 0;
  techPatches.length = 0;
});

describe("subscribePushAction", () => {
  it("stores exactly one row for a successful subscribe", async () => {
    const result = await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
      keys: { p256dh: "pk1", auth: "ak1" },
      userAgent: "Android",
    });
    expect(result).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.endpoint).toContain("device-a");
    expect(rows[0]!.p256dh).toBe("pk1");
  });

  it("re-subscribing the same endpoint updates rather than duplicating", async () => {
    await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
      p256dh: "pk1",
      auth: "ak1",
    });
    const id = rows[0]!.id;
    const result = await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
      p256dh: "pk2",
      auth: "ak2",
    });
    expect(result).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(id);
    expect(rows[0]!.p256dh).toBe("pk2");
    expect(rows[0]!.auth).toBe("ak2");
  });

  it("returns a specific error for an incomplete browser payload", async () => {
    const result = await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      keys: { p256dh: "", auth: "" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_payload");
      expect(result.error).toMatch(/incomplete/i);
    }
    expect(rows).toHaveLength(0);
  });
});

describe("email-disable gate (same session)", () => {
  it("blocks turning email off when no subscription exists", async () => {
    const result = await updatePushPrefsAction({ emailAlso: false });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Enable push/i);
    expect(result.subscriptionCount).toBe(0);
    expect(techPatches).toHaveLength(0);
  });

  it("permits turning email off once a subscription exists", async () => {
    await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/device-b",
      p256dh: "pk",
      auth: "ak",
    });
    const result = await updatePushPrefsAction({ emailAlso: false });
    expect(result).toMatchObject({ ok: true, subscriptionCount: 1 });
    expect(techPatches.at(-1)?.pushPrefs).toMatchObject({ emailAlso: false });
  });

  it("subscribe then immediately disable email in the same session succeeds", async () => {
    // Mirrors: enable notifications → save → turn off emails without a page reload.
    const sub = await subscribePushAction({
      endpoint: "https://fcm.googleapis.com/fcm/send/same-session",
      keys: { p256dh: "pk", auth: "ak" },
    });
    expect(sub).toEqual({ ok: true });
    expect(rows).toHaveLength(1);

    const prefs = await updatePushPrefsAction({
      emailAlso: false,
      kinds: { new_booking: true },
    });
    expect(prefs.ok).toBe(true);
    expect(prefs.subscriptionCount).toBe(1);
    expect(techPatches.at(-1)?.pushPrefs).toMatchObject({ emailAlso: false });
  });
});
