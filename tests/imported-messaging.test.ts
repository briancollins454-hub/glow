import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  allowsClientFacingMessaging,
  hasNeverSubscribed,
  maySendClientReminder,
} from "@/lib/client-messaging";
import {
  groupBatchableReminders,
  salonDayKey,
  reminderBatchKey,
} from "@/lib/reminder-batch";
import { makeBooking, makeClient, makeTech } from "./fixtures";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Reminder } from "@/lib/db/types";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "rem_1",
    techId: "tech_1",
    bookingId: "bk_1",
    clientId: "cli_1",
    channel: "email",
    kind: "reminder_24h",
    sendAtIso: "2026-07-01T10:00:00.000Z",
    status: "scheduled",
    preview: "",
    sentAtIso: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("client messaging gates", () => {
  it("never-subscribed accounts are blocked until confirmation", () => {
    const never = makeTech({ subscriptionStatus: "none", stripeSubscriptionId: null });
    expect(hasNeverSubscribed(never)).toBe(true);
    expect(allowsClientFacingMessaging(never)).toBe(false);
    expect(
      allowsClientFacingMessaging({
        ...never,
        clientMessagingConfirmedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("live accounts can message clients", () => {
    expect(allowsClientFacingMessaging(makeTech({ subscriptionStatus: "active" }))).toBe(true);
  });

  it("imported bookings send nothing until opt-in; opt-in enables reminders but never balance", () => {
    const tech = makeTech({
      subscriptionStatus: "active",
      importedBookingRemindersOptIn: false,
    });
    const imported = makeBooking({
      importedAt: "2026-07-01T00:00:00.000Z",
      importedBalanceRequestEnabled: false,
      balancePennies: 5000,
      balanceStatus: "unpaid",
    });
    expect(maySendClientReminder(tech, imported, "reminder_24h")).toBe(false);
    expect(maySendClientReminder(tech, imported, "balance_request")).toBe(false);
    expect(maySendClientReminder(tech, imported, "confirmation")).toBe(false);

    const opted = { ...tech, importedBookingRemindersOptIn: true };
    expect(maySendClientReminder(opted, imported, "reminder_24h")).toBe(true);
    expect(maySendClientReminder(opted, imported, "balance_request")).toBe(false);
    expect(
      maySendClientReminder(opted, { ...imported, importedBalanceRequestEnabled: true }, "balance_request"),
    ).toBe(true);
  });

  it("native bookings follow the account gate only", () => {
    const live = makeTech({ subscriptionStatus: "trialing" });
    const booking = makeBooking({ importedAt: null });
    expect(maySendClientReminder(live, booking, "reminder_24h")).toBe(true);
    expect(maySendClientReminder(live, booking, "balance_request")).toBe(true);
  });
});

describe("reminder batching", () => {
  it("groups three same-day reminder_24h for one client into one batch key", () => {
    const clientId = "cli_same";
    const day = "2026-08-10T10:00:00.000Z";
    const items = [0, 1, 2].map((i) => {
      const start = new Date(day);
      start.setUTCHours(9 + i, 0, 0, 0);
      const booking = makeBooking({
        id: `bk_${i}`,
        clientId,
        startIso: start.toISOString(),
      });
      return {
        reminder: makeReminder({ id: `rem_${i}`, bookingId: booking.id, kind: "reminder_24h" }),
        booking,
      };
    });
    const groups = groupBatchableReminders(items, { tech_1: "Europe/London" });
    expect(groups.size).toBe(1);
    const only = [...groups.values()][0];
    expect(only).toHaveLength(3);
    expect(salonDayKey(items[0].booking.startIso, "Europe/London")).toBe(salonDayKey(items[2].booking.startIso, "Europe/London"));
  });

  it("groups balance requests by client (not by day)", () => {
    const a = makeBooking({
      id: "bk_a",
      clientId: "cli_1",
      startIso: "2026-08-10T10:00:00.000Z",
    });
    const b = makeBooking({
      id: "bk_b",
      clientId: "cli_1",
      startIso: "2026-08-12T10:00:00.000Z",
    });
    const groups = groupBatchableReminders([
      { reminder: makeReminder({ id: "r1", kind: "balance_request", bookingId: a.id }), booking: a },
      { reminder: makeReminder({ id: "r2", kind: "balance_request", bookingId: b.id }), booking: b },
    ], { tech_1: "Europe/London" });
    expect(groups.size).toBe(1);
    expect(reminderBatchKey("balance_request", "tech_1", "cli_1", a.startIso, "Europe/London")).toBe(
      reminderBatchKey("balance_request", "tech_1", "cli_1", b.startIso, "Europe/London"),
    );
  });
});

describe("imported booking messaging wiring", () => {
  it("migration 0055 adds importedAt and opt-in columns", () => {
    const sql = read("supabase/migrations/0055_imported_booking_messaging.sql");
    expect(sql).toContain("importedAt");
    expect(sql).toContain("importedBalanceRequestEnabled");
    expect(sql).toContain("importedBookingRemindersOptIn");
    expect(sql).toContain("clientMessagingConfirmedAt");
  });

  it("csv import stamps importedAt and never enables balance requests", () => {
    const src = read("lib/import/csv-import.ts");
    expect(src).toContain("importedAt:");
    expect(src).toContain("importedBalanceRequestEnabled: false");
    expect(src).toContain("upcomingImported");
  });

  it("scheduleReminders gates imported and never-subscribed messaging", () => {
    const src = read("lib/bookings.ts");
    expect(src).toContain("maySendClientReminder");
    expect(src).toContain("scheduleRemindersForImportedOptIn");
    expect(src).toContain("!booking.importedAt");
  });

  it("opt-in UI asks before messaging imported clients", () => {
    const ui = read("components/dashboard/imported-reminders-opt-in.tsx");
    expect(ui).toContain("Do you want Glow to send reminders to these clients?");
    expect(ui).toContain("optInImportedBookingRemindersAction");
    expect(read("app/dashboard/actions.ts")).toContain("importedBookingRemindersOptIn: true");
  });

  it("scheduler batches reminders and rate-limits balance requests", () => {
    const src = read("lib/scheduler.ts");
    expect(src).toContain("groupBatchableReminders");
    expect(src).toContain("sendBatchedReminders");
    expect(src).toContain("hasRecentBalanceRequest");
  });
});

describe("outbound techId attribution", () => {
  it("sendReminder and SMS logging pass techId", () => {
    const notify = read("lib/notify.ts");
    expect(notify).toMatch(/sendEmail\(\{[\s\S]*?techId: booking\.techId/);
    expect(notify).toContain('sendSms(client.phone, text, { techId: booking.techId');
    const sms = read("lib/sms.ts");
    expect(sms).toContain("techId: opts?.techId ?? null");
    const email = read("lib/email.ts");
    expect(email).toContain("techId: opts.techId ?? null");
  });
});

describe("processDueReminders batch send behaviour", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("a client with three same-day bookings receives one reminder email", async () => {
    const tech = makeTech({ subscriptionStatus: "active" });
    const client = makeClient({ id: "cli_multi", email: "multi@salon.test" });
    const dayStarts = [0, 1, 2].map((i) => {
      const booking = makeBooking({
        id: `bk_d${i}`,
        clientId: client.id,
        techId: tech.id,
        serviceId: "svc_1",
        startIso: `2026-08-10T${String(9 + i).padStart(2, "0")}:00:00.000Z`,
        status: "confirmed",
        importedAt: null,
      });
      return {
        reminder: makeReminder({
          id: `rem_d${i}`,
          bookingId: booking.id,
          techId: tech.id,
          clientId: client.id,
          kind: "reminder_24h",
          status: "scheduled",
          sendAtIso: "2026-08-09T10:00:00.000Z",
        }),
        booking,
      };
    });

    const marked: string[] = [];
    const emails: Array<{ techId?: string | null; subject?: string }> = [];

    vi.doMock("@/lib/db/queries", () => ({
      dueReminders: async () => dayStarts.map((d) => d.reminder),
      getBooking: async (_sb: unknown, id: string) =>
        dayStarts.find((d) => d.booking.id === id)?.booking ?? null,
      getTechById: async () => tech,
      getClient: async () => client,
      getService: async () => ({ id: "svc_1", name: "Classic Full Set" }),
      markReminder: async (_sb: unknown, id: string, patch: { status?: string }) => {
        if (patch.status) marked.push(`${id}:${patch.status}`);
      },
    }));
    vi.doMock("@/lib/email", () => ({
      sendEmail: async (opts: { techId?: string | null; subject?: string }) => {
        emails.push(opts);
        return true;
      },
      brandedEmail: () => "<html/>",
      emailConfigured: () => true,
    }));
    vi.doMock("@/lib/sms", () => ({
      smsConfigured: () => false,
      techAllowsSms: () => false,
      sendSms: vi.fn(),
    }));

    const { processDueReminders } = await import("@/lib/scheduler");
    const result = await processDueReminders({} as never, "2026-08-09T12:00:00.000Z");
    expect(emails).toHaveLength(1);
    expect(emails[0].techId).toBe(tech.id);
    expect(result.sent).toBe(3);
    expect(marked.filter((m) => m.endsWith(":sent"))).toHaveLength(3);
  });

  it("balance requests are capped at one per client per 48 hours", async () => {
    const tech = makeTech({ subscriptionStatus: "active", balanceEmailsEnabled: true });
    const client = makeClient({ id: "cli_bal", email: "bal@salon.test" });
    const bookings = [0, 1].map((i) =>
      makeBooking({
        id: `bk_b${i}`,
        clientId: client.id,
        techId: tech.id,
        balancePennies: 2000,
        balanceStatus: "unpaid",
        startIso: `2026-08-${10 + i}T10:00:00.000Z`,
      }),
    );
    const reminders = bookings.map((b, i) =>
      makeReminder({
        id: `rem_b${i}`,
        bookingId: b.id,
        techId: tech.id,
        clientId: client.id,
        kind: "balance_request",
        status: "scheduled",
        sendAtIso: "2026-08-08T10:00:00.000Z",
      }),
    );

    const marked: Array<{ id: string; status?: string; preview?: string }> = [];
    vi.doMock("@/lib/db/queries", () => ({
      dueReminders: async () => reminders,
      getBooking: async (_sb: unknown, id: string) => bookings.find((b) => b.id === id) ?? null,
      getTechById: async () => tech,
      getClient: async () => client,
      getService: async () => ({ id: "svc_1", name: "Classic Full Set" }),
      markReminder: async (
        _sb: unknown,
        id: string,
        patch: { status?: string; preview?: string },
      ) => {
        marked.push({ id, ...patch });
      },
    }));

    vi.doMock("@/lib/notify", async () => {
      const actual = await vi.importActual<typeof import("@/lib/notify")>("@/lib/notify");
      return {
        ...actual,
        hasRecentBalanceRequest: async () => true,
      };
    });
    vi.doMock("@/lib/sms", () => ({
      smsConfigured: () => false,
      techAllowsSms: () => false,
      sendSms: vi.fn(),
    }));

    const send = vi.fn(async () => ({ data: { id: "re_x" }, error: null }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
    }));

    const { processDueReminders } = await import("@/lib/scheduler");
    await processDueReminders({} as never, "2026-08-08T12:00:00.000Z");
    expect(send).not.toHaveBeenCalled();
    expect(marked.every((m) => m.status === "skipped")).toBe(true);
    expect(marked.some((m) => String(m.preview).includes("48 hours"))).toBe(true);
  });

  it("imported bookings send nothing until opt-in", async () => {
    const tech = makeTech({
      subscriptionStatus: "active",
      importedBookingRemindersOptIn: false,
    });
    const booking = makeBooking({
      id: "bk_imp",
      importedAt: "2026-07-01T00:00:00.000Z",
      status: "confirmed",
      startIso: "2026-08-20T10:00:00.000Z",
    });
    const reminder = makeReminder({
      id: "rem_imp",
      bookingId: booking.id,
      techId: tech.id,
      kind: "reminder_24h",
      status: "scheduled",
      sendAtIso: "2026-08-19T10:00:00.000Z",
    });
    const marked: string[] = [];
    vi.doMock("@/lib/db/queries", () => ({
      dueReminders: async () => [reminder],
      getBooking: async () => booking,
      getTechById: async () => tech,
      markReminder: async (_sb: unknown, id: string, patch: { status?: string }) => {
        marked.push(`${id}:${patch.status}`);
      },
    }));
    const send = vi.fn();
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));
    vi.doMock("@/lib/sms", () => ({
      smsConfigured: () => false,
      techAllowsSms: () => false,
      sendSms: vi.fn(),
    }));

    const { processDueReminders } = await import("@/lib/scheduler");
    const result = await processDueReminders({} as never, "2026-08-19T12:00:00.000Z");
    expect(send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(marked).toContain("rem_imp:skipped");
  });
});
