import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  isMarketingKind,
  isOutboundAllowlisted,
  outboundBlockReason,
  KILL_SWITCH_LABELS,
} from "@/lib/owner/controls";
import { cancelledReminderStatus, groupByKind } from "@/lib/owner/outbound";
import {
  bookingsDownOverHalf,
  bounceRateHigh,
  cronFailureStreak,
} from "@/lib/owner/alerts";
import { fingerprintError } from "@/lib/owner/error-groups";
import { isInvalidEmail, isPastConfirmed } from "@/lib/owner/data-quality";
import { PREVIEW_SENDS_NOTHING, classifyKind, previewReminderTemplate } from "@/lib/owner/templates";
import { cronJobOverdue, averageDurationMs, CRON_JOB_CATALOG } from "@/lib/owner/ops";
import type { Booking, Client, Service, Tech } from "@/lib/db/types";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 3 kill switches", () => {
  it("classifies marketing vs transactional and allowlists ops", () => {
    expect(isMarketingKind("rebook_nudge")).toBe(true);
    expect(isMarketingKind("confirmation")).toBe(false);
    expect(isOutboundAllowlisted("password_reset")).toBe(true);
    expect(isOutboundAllowlisted("confirmation")).toBe(false);
    expect(Object.keys(KILL_SWITCH_LABELS)).toContain("allOutboundPaused");
    expect(Object.keys(KILL_SWITCH_LABELS)).toContain("clientPaymentsPaused");
  });

  it("blocks at send layer in email and sms", () => {
    const email = read("lib/email.ts");
    const sms = read("lib/sms.ts");
    expect(email).toContain("outboundBlockReason");
    expect(sms).toContain("outboundBlockReason");
    expect(read("lib/owner/ops.ts")).toContain("cronJobsPaused");
    expect(read("app/(auth)/actions.ts")).toContain("signupsPaused");
    expect(read("lib/subscriptions.ts")).toContain("clientPaymentsPaused");
  });

  it("outboundBlockReason respects allowlist without DB when allowlisted", async () => {
    await expect(
      outboundBlockReason({ kind: "password_reset", techId: "tech_x" }),
    ).resolves.toBeNull();
  });

  it("banner and controls page exist", () => {
    expect(existsSync(join(process.cwd(), "components/owner/kill-switch-banner.tsx"))).toBe(true);
    expect(read("app/dashboard/admin/layout.tsx")).toContain("KillSwitchBanner");
    expect(read("app/dashboard/admin/controls/page.tsx")).toContain("setKillSwitchAction");
  });
});

describe("Phase 3 outbound preview", () => {
  it("cancel maps to skipped status", () => {
    expect(cancelledReminderStatus()).toBe("skipped");
  });

  it("groups by kind", () => {
    const groups = groupByKind([
      {
        id: "1",
        source: "reminder",
        sourceId: "1",
        techId: "t",
        techLabel: "T",
        bookingId: null,
        clientId: null,
        kind: "reminder_24h",
        channel: "email",
        destination: "a@b.com",
        scheduledFor: new Date().toISOString(),
        triggerLabel: "x",
        subject: "s",
        bodyPreview: "b",
        marketing: false,
        status: "scheduled",
      },
      {
        id: "2",
        source: "reminder",
        sourceId: "2",
        techId: "t",
        techLabel: "T",
        bookingId: null,
        clientId: null,
        kind: "reminder_24h",
        channel: "email",
        destination: "c@d.com",
        scheduledFor: new Date().toISOString(),
        triggerLabel: "x",
        subject: "s",
        bodyPreview: "b",
        marketing: false,
        status: "scheduled",
      },
    ]);
    expect(groups[0]).toEqual({ kind: "reminder_24h", count: 2 });
  });

  it("mirrors reminders and cancel paths are wired", () => {
    expect(read("lib/db/queries.ts")).toContain("mirrorReminderToScheduledSends");
    expect(read("lib/owner/outbound.ts")).toContain("cancelOutboundSend");
    expect(read("app/dashboard/admin/outbound/page.tsx")).toContain("cancelOutboundSendAction");
    expect(read("app/dashboard/admin/accounts/[id]/page.tsx")).toContain("Upcoming client-facing sends");
  });
});

describe("Phase 3 template previewer", () => {
  it("renders without sending", () => {
    expect(PREVIEW_SENDS_NOTHING).toBe(true);
    expect(classifyKind("rebook_nudge")).toBe("marketing");
    expect(classifyKind("confirmation")).toBe("transactional");
    const src = read("lib/owner/templates.ts");
    expect(src).not.toMatch(/sendEmail\(|sendSms\(|resend\.emails/);
    const tech = {
      id: "tech_1",
      businessName: "Test Salon",
      email: "owner@example.com",
      brandColor: "#C4785A",
      handle: "test",
    } as Tech;
    const booking = {
      id: "bk_1",
      startIso: "2026-08-01T10:00:00.000Z",
      endIso: "2026-08-01T11:00:00.000Z",
      pricePennies: 5000,
      depositPennies: 0,
      balancePennies: 5000,
      balanceToken: null,
      serviceId: "svc_1",
      techId: "tech_1",
    } as Booking;
    const preview = previewReminderTemplate({
      kind: "confirmation",
      tech,
      booking,
      client: { id: "cli_1", name: "Ada", email: "ada@example.com", phone: "" } as Client,
      service: { id: "svc_1", name: "Cut" } as Service,
      channel: "email",
    });
    expect(preview.subject).toContain("Test Salon");
    expect(preview.from).toBeTruthy();
    expect(preview.text.length).toBeGreaterThan(0);
  });
});

describe("Phase 3 anomaly predicates", () => {
  it("fires only on seeded threshold conditions", () => {
    expect(bookingsDownOverHalf(4, 10)).toBe(true);
    expect(bookingsDownOverHalf(6, 10)).toBe(false);
    expect(bookingsDownOverHalf(0, 0)).toBe(false);
    expect(bounceRateHigh(100, 3)).toBe(true);
    expect(bounceRateHigh(100, 1)).toBe(false);
    expect(bounceRateHigh(10, 1)).toBe(false);
    expect(cronFailureStreak([false, false, true])).toBe(true);
    expect(cronFailureStreak([false, true, false])).toBe(false);
  });
});

describe("Phase 3 error grouping + data quality", () => {
  it("collapses identical fingerprints", () => {
    expect(fingerprintError("boom", "Error")).toBe(fingerprintError("boom", "Error"));
    expect(fingerprintError("a")).not.toBe(fingerprintError("b"));
  });

  it("detects invalid emails and past confirmed without false positives", () => {
    expect(isInvalidEmail("not-an-email")).toBe(true);
    expect(isInvalidEmail("ok@example.com")).toBe(false);
    expect(isInvalidEmail(null)).toBe(false);
    expect(isPastConfirmed("confirmed", "2020-01-01T00:00:00.000Z")).toBe(true);
    expect(isPastConfirmed("confirmed", "2099-01-01T00:00:00.000Z")).toBe(false);
    expect(isPastConfirmed("cancelled", "2020-01-01T00:00:00.000Z")).toBe(false);
  });
});

describe("Phase 3 cron console", () => {
  it("catalog and overdue helpers", () => {
    expect(CRON_JOB_CATALOG.some((j) => j.job === "reminders")).toBe(true);
    expect(cronJobOverdue(null, 25)).toBe(true);
    expect(cronJobOverdue(new Date().toISOString(), 25)).toBe(false);
    expect(
      averageDurationMs([
        {
          id: "1",
          job: "reminders",
          trigger: "cron",
          ok: true,
          result: {},
          error: null,
          durationMs: 100,
          startedAt: "",
          finishedAt: null,
        },
        {
          id: "2",
          job: "reminders",
          trigger: "cron",
          ok: true,
          result: {},
          error: null,
          durationMs: 200,
          startedAt: "",
          finishedAt: null,
        },
      ]),
    ).toBe(150);
  });
});

describe("Phase 3 routes + migration + GDPR", () => {
  it("owner pages and actions are gated", () => {
    for (const p of [
      "outbound",
      "controls",
      "alerts",
      "events",
      "webhooks",
      "errors",
      "data-quality",
      "templates",
      "flags",
      "audit",
      "gdpr",
    ]) {
      const page = read(`app/dashboard/admin/${p}/page.tsx`);
      expect(page).toContain("requireOwner");
    }
    const actions = read("app/dashboard/admin/phase3-actions.ts");
    expect(actions).toContain("assertNotViewAs");
    expect(actions).toContain("requireOwner");
  });

  it("migration 0060 covers consent immutability and flags", () => {
    const mig = read("supabase/migrations/0060_owner_console_phase3.sql");
    expect(mig).toContain("resend_webhook_events");
    expect(mig).toContain("consent_records_immutable");
    expect(mig).toContain("feature_flags");
    expect(mig).toContain("scheduled_sends");
  });

  it("consent never bulk-deleted; audit export + gdpr routes exist", () => {
    expect(read("lib/owner/account-moderation.ts")).toContain("consent_records are NEVER bulk-deleted");
    expect(existsSync(join(process.cwd(), "app/api/owner/gdpr-export/route.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/api/owner/audit-export/route.ts"))).toBe(true);
    expect(read("app/api/owner/gdpr-export/route.ts")).toContain("requireOwner");
  });

  it("stripe webhook stores payload and exports replay helper", () => {
    const route = read("app/api/stripe/webhook/route.ts");
    expect(route).toContain("processStripeEventForReplay");
    expect(route).toContain("payload");
    expect(read("lib/stripe-webhook-process.ts")).toContain("export async function processStripeEventForReplay");
    expect(read("app/api/resend/webhook/route.ts")).toContain("resend_webhook_events");
  });

  it("webhook replay deletes prior claim (idempotent reclaim)", () => {
    const src = read("lib/owner/webhooks.ts");
    expect(src).toContain("replayStripeWebhookEvent");
    expect(src).toContain('delete().eq("eventId"');
    expect(src).toContain("claimStripeWebhookEvent");
  });
});
