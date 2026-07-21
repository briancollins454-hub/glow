import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { sendsBalanceEmails } from "@/lib/subscriptions";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("sendsBalanceEmails", () => {
  it("defaults to on (missing / null / pre-migration)", () => {
    expect(sendsBalanceEmails(null)).toBe(true);
    expect(sendsBalanceEmails(undefined)).toBe(true);
    expect(sendsBalanceEmails({})).toBe(true);
    expect(sendsBalanceEmails({ balanceEmailsEnabled: null })).toBe(true);
    expect(sendsBalanceEmails({ balanceEmailsEnabled: true })).toBe(true);
  });

  it("off only when explicitly disabled", () => {
    expect(sendsBalanceEmails({ balanceEmailsEnabled: false })).toBe(false);
  });
});

describe("balance email toggle wiring", () => {
  it("scheduler skips queued balance requests when disabled", () => {
    const scheduler = read("lib/scheduler.ts");
    expect(scheduler).toContain("sendsBalanceEmails");
    expect(scheduler).toMatch(/balance_request[\s\S]*sendsBalanceEmails/);
  });

  it("new bookings only queue balance requests when enabled", () => {
    const bookings = read("lib/bookings.ts");
    expect(bookings).toContain("balanceEmailsOnFor");
    // Both scheduleReminders and rescheduleReminders paths are guarded.
    expect(bookings.match(/balanceEmailsOnFor\(sb, booking\.techId\)/g)?.length).toBe(2);
  });

  it("confirmation email hides the pay-early button when disabled", () => {
    const notify = read("lib/notify.ts");
    expect(notify).toMatch(/balancePennies > 0 && sendsBalanceEmails\(tech\)/);
  });

  it("settings exposes the toggle and the action saves it", () => {
    expect(read("app/dashboard/settings/page.tsx")).toContain('name="balanceEmailsEnabled"');
    expect(read("app/dashboard/actions.ts")).toContain(
      'balanceEmailsEnabled: formData.get("balanceEmailsEnabled") === "on"',
    );
  });

  it("migration adds the column defaulting to on", () => {
    const sql = read("supabase/migrations/0043_balance_emails_toggle.sql");
    expect(sql).toMatch(/balanceEmailsEnabled" boolean not null default true/);
  });
});
