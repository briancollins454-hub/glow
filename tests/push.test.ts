import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { makeTech } from "./fixtures";
import type { PushSubscriptionRow } from "@/lib/db/types";

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

// ---- module mocks ----------------------------------------------------------

const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: () => sendNotification(),
  },
}));

const subs: PushSubscriptionRow[] = [];
const deleted: string[] = [];
const patched: Array<{ id: string; patch: Partial<PushSubscriptionRow> }> = [];
const queued: unknown[] = [];
const techPatches: Array<Record<string, unknown>> = [];
const emails: Array<{ to: string; subject: string }> = [];

vi.mock("@/lib/db/queries", () => ({
  listPushSubscriptions: async () => subs.filter((s) => !deleted.includes(s.id)),
  deletePushSubscription: async (_sb: unknown, id: string) => {
    deleted.push(id);
  },
  updatePushSubscription: async (_sb: unknown, id: string, patch: Partial<PushSubscriptionRow>) => {
    patched.push({ id, patch });
    const row = subs.find((s) => s.id === id);
    if (row && typeof patch.failureCount === "number") row.failureCount = patch.failureCount;
  },
  createPushQueueItem: async (_sb: unknown, item: unknown) => {
    queued.push(item);
  },
  duePushQueueItems: async () => [],
  deletePushQueueItem: async () => undefined,
  listPushSubscriptionTechIds: async () => [],
  getTechById: async () => currentTech,
  updateTech: async (_sb: unknown, _id: string, patch: Record<string, unknown>) => {
    techPatches.push(patch);
  },
  listBookingsInWindow: async () => [],
}));

vi.mock("@/lib/email", () => ({
  sendEmail: async (opts: { to: string; subject: string }) => {
    emails.push({ to: opts.to, subject: opts.subject });
    return true;
  },
  brandedEmail: () => "<html/>",
}));

import {
  inQuietHours,
  pushEmailAlso,
  pushKindEnabled,
  quietHoursEndInstant,
  sendPushToTech,
  techEmailSuppressed,
  handleLastSubscriptionGone,
  PUSH_MAX_FAILURES,
} from "@/lib/push";
import { classifyPushSupport } from "@/lib/push-support";
import type { SupabaseClient } from "@supabase/supabase-js";

const sb = {} as SupabaseClient;
let currentTech = makeTech();

function makeSub(overrides: Partial<PushSubscriptionRow> = {}): PushSubscriptionRow {
  return {
    id: `psub_${Math.random().toString(36).slice(2, 8)}`,
    techId: "tech_1",
    staffId: null,
    endpoint: "https://push.example/abc",
    p256dh: "k",
    auth: "a",
    userAgent: "test",
    createdAt: "2026-07-01T00:00:00.000Z",
    lastSeenAt: "2026-07-01T00:00:00.000Z",
    failureCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  sendNotification.mockClear();
  sendNotification.mockImplementation(async () => ({ statusCode: 201 }));
  subs.length = 0;
  deleted.length = 0;
  patched.length = 0;
  queued.length = 0;
  techPatches.length = 0;
  emails.length = 0;
  currentTech = makeTech();
});

// ---- prefs -----------------------------------------------------------------

describe("push preferences", () => {
  it("all types default on; toggles respected", () => {
    expect(pushKindEnabled(null, "new_booking")).toBe(true);
    expect(pushKindEnabled({}, "daily_summary")).toBe(true);
    expect(pushKindEnabled({ kinds: { new_booking: false } }, "new_booking")).toBe(false);
    expect(pushKindEnabled({ kinds: { new_booking: false } }, "booking_cancelled")).toBe(true);
  });

  it("emailAlso defaults on", () => {
    expect(pushEmailAlso(null)).toBe(true);
    expect(pushEmailAlso({ emailAlso: false })).toBe(false);
  });

  it("a disabled kind sends nothing", async () => {
    subs.push(makeSub());
    const tech = makeTech({ pushPrefs: { kinds: { new_booking: false } } });
    const sent = await sendPushToTech(sb, tech, "new_booking", {
      title: "t",
      body: "b",
      url: "/dashboard",
    });
    expect(sent).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

// ---- delivery & failure handling -------------------------------------------

describe("push delivery", () => {
  it("sends to every device and returns the count", async () => {
    subs.push(makeSub({ id: "s1" }), makeSub({ id: "s2", endpoint: "https://push.example/def" }));
    const sent = await sendPushToTech(sb, makeTech(), "new_booking", {
      title: "New booking · Sarah Jones",
      body: "Gel nails · Mon 3 Aug at 10:00",
      url: "/dashboard/bookings/bk_1",
    });
    expect(sent).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("staff devices only get their own bookings; owner devices get everything", async () => {
    subs.push(
      makeSub({ id: "owner-dev", staffId: null }),
      makeSub({ id: "amy-dev", staffId: "stf_amy", endpoint: "https://push.example/amy" }),
      makeSub({ id: "ben-dev", staffId: "stf_ben", endpoint: "https://push.example/ben" }),
    );
    const sent = await sendPushToTech(
      sb,
      makeTech(),
      "new_booking",
      { title: "t", body: "b", url: "/dashboard" },
      { staffId: "stf_amy" },
    );
    expect(sent).toBe(2); // owner + Amy, not Ben
  });

  it("a 410 response deletes the subscription", async () => {
    subs.push(makeSub({ id: "gone" }));
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    const sent = await sendPushToTech(sb, makeTech(), "new_booking", {
      title: "t",
      body: "b",
      url: "/dashboard",
    });
    expect(sent).toBe(0);
    expect(deleted).toContain("gone");
  });

  it("a 404 response deletes the subscription", async () => {
    subs.push(makeSub({ id: "gone404" }));
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("nf"), { statusCode: 404 }));
    await sendPushToTech(sb, makeTech(), "new_booking", { title: "t", body: "b", url: "/d" });
    expect(deleted).toContain("gone404");
  });

  it("other failures increment failureCount and delete after 5 consecutive", async () => {
    subs.push(makeSub({ id: "flaky", failureCount: PUSH_MAX_FAILURES - 2 }));
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    await sendPushToTech(sb, makeTech(), "new_booking", { title: "t", body: "b", url: "/d" });
    expect(deleted).toHaveLength(0);
    expect(patched.at(-1)?.patch.failureCount).toBe(PUSH_MAX_FAILURES - 1);

    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    await sendPushToTech(sb, makeTech(), "new_booking", { title: "t", body: "b", url: "/d" });
    expect(deleted).toContain("flaky");
  });

  it("push failures never throw out of sendPushToTech", async () => {
    subs.push(makeSub());
    sendNotification.mockRejectedValue(new Error("network down"));
    await expect(
      sendPushToTech(sb, makeTech(), "new_booking", { title: "t", body: "b", url: "/d" }),
    ).resolves.toBe(0);
  });
});

// ---- quiet hours ------------------------------------------------------------

describe("quiet hours", () => {
  const prefs = { quietHoursEnabled: true, quietStart: "21:00", quietEnd: "08:00" };
  const tz = "Europe/London";

  it("detects overnight windows in the salon's zone", () => {
    const at = (iso: string) => new Date(iso).getTime();
    expect(inQuietHours(prefs, tz, at("2026-07-01T22:30:00.000Z"))).toBe(true); // 23:30 BST
    expect(inQuietHours(prefs, tz, at("2026-07-01T05:30:00.000Z"))).toBe(true); // 06:30 BST
    expect(inQuietHours(prefs, tz, at("2026-07-01T11:00:00.000Z"))).toBe(false); // midday
    expect(inQuietHours(null, tz)).toBe(false); // default off
  });

  it("queues non-urgent pushes until the quiet period ends", async () => {
    subs.push(makeSub());
    const tech = makeTech({ pushPrefs: prefs });
    const nightMs = new Date("2026-07-01T22:30:00.000Z").getTime();
    // quietHoursEndInstant → 08:00 London next morning
    const end = quietHoursEndInstant(prefs, tz, nightMs);
    expect(end.toISOString()).toBe("2026-07-02T07:00:00.000Z"); // 08:00 BST

    vi.useFakeTimers();
    vi.setSystemTime(nightMs);
    try {
      const sent = await sendPushToTech(sb, tech, "new_booking", {
        title: "t",
        body: "b",
        url: "/d",
      });
      expect(sent).toBe(0);
      expect(queued).toHaveLength(1);
      expect(sendNotification).not.toHaveBeenCalled();

      // Cancellations are urgent and bypass the queue.
      const urgent = await sendPushToTech(
        sb,
        tech,
        "booking_cancelled",
        { title: "t", body: "b", url: "/d" },
        { urgent: true },
      );
      expect(urgent).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---- email supplement --------------------------------------------------------

describe("email supplement", () => {
  it("suppresses tech email only when emailAlso is off AND a subscription exists", async () => {
    const off = makeTech({ pushPrefs: { emailAlso: false } });
    expect(await techEmailSuppressed(sb, makeTech())).toBe(false); // emailAlso default on
    expect(await techEmailSuppressed(sb, off)).toBe(false); // no subscriptions
    subs.push(makeSub());
    expect(await techEmailSuppressed(sb, off)).toBe(true);
  });

  it("re-enables email and notifies the tech when the last subscription dies", async () => {
    currentTech = makeTech({ pushPrefs: { emailAlso: false } });
    await handleLastSubscriptionGone(sb, currentTech.id);
    expect(techPatches.at(-1)?.pushPrefs).toMatchObject({ emailAlso: true });
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/email/i);
  });

  it("does nothing when subscriptions remain or email is already on", async () => {
    subs.push(makeSub());
    currentTech = makeTech({ pushPrefs: { emailAlso: false } });
    await handleLastSubscriptionGone(sb, currentTech.id);
    expect(techPatches).toHaveLength(0);

    subs.length = 0;
    currentTech = makeTech(); // emailAlso default on
    await handleLastSubscriptionGone(sb, currentTech.id);
    expect(techPatches).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });
});

// ---- device support ----------------------------------------------------------

describe("classifyPushSupport (iOS constraint)", () => {
  const iphoneSafari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const oldIphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1";
  const android =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";

  it("iOS in Safari (not installed) needs install guidance, not an enable button", () => {
    expect(
      classifyPushSupport({ userAgent: iphoneSafari, standalone: false, hasPushApi: false }),
    ).toEqual({ state: "ios_install_required" });
  });

  it("iOS installed but too old states that plainly", () => {
    expect(
      classifyPushSupport({ userAgent: oldIphone, standalone: true, hasPushApi: false }),
    ).toEqual({ state: "ios_version_too_old", version: "16.1" });
  });

  it("iOS installed on 16.4+ is supported", () => {
    expect(
      classifyPushSupport({ userAgent: iphoneSafari, standalone: true, hasPushApi: true }),
    ).toEqual({ state: "supported" });
  });

  it("Android and desktop use the standard flow", () => {
    expect(classifyPushSupport({ userAgent: android, standalone: false, hasPushApi: true })).toEqual(
      { state: "supported" },
    );
    expect(classifyPushSupport({ userAgent: android, standalone: false, hasPushApi: false })).toEqual(
      { state: "unsupported" },
    );
  });
});

// ---- service worker wiring -----------------------------------------------------

describe("service worker push handlers", () => {
  const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

  it("handles push and notificationclick", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("showNotification");
  });

  it("notificationclick deep-links to the notification url", () => {
    expect(sw).toContain('data: { url: data.url || "/dashboard" }');
    expect(sw).toContain("openWindow(url)");
  });

  it("keeps the existing PWA install/caching behaviour", () => {
    expect(sw).toContain('addEventListener("install"');
    expect(sw).toContain('addEventListener("fetch"');
    expect(sw).toContain("glow-shell-v3");
  });
});
