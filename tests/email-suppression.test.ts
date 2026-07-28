import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applySoftBounceCount,
  classifyBounce,
  normaliseEmail,
} from "@/lib/email-suppression";
import {
  accountEmailDeliveryWarning,
  clientEmailDeliveryBadge,
} from "@/lib/email-delivery-ui";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

type Row = Record<string, unknown>;

function emailsMatch(a: unknown, b: unknown) {
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}

/** Minimal supabase mock for suppression + account-email lookups. */
function makeSb(opts: {
  store?: Map<string, Row>;
  clients?: Row[];
  techs?: Row[];
  staff?: Row[];
  opsSends?: Array<Row>;
}) {
  const store = opts.store ?? new Map<string, Row>();
  const clients = opts.clients ?? [];
  const techs = opts.techs ?? [];
  const staff = opts.staff ?? [];
  const opsSends = opts.opsSends ?? [];

  const sb = {
    from(table: string) {
      if (table === "email_suppressions") {
        return {
          select(_cols?: string) {
            return {
              eq(_col: string, email: string) {
                if (_cols === undefined || _col === "email") {
                  // select("*").eq("email") or select("email").eq("suppressed")
                }
                if (_col === "suppressed") {
                  const data = [...store.values()].filter((r) => !!r.suppressed);
                  return Promise.resolve({ data, error: null });
                }
                return {
                  maybeSingle: async () => ({
                    data: store.get(String(email).toLowerCase()) ?? null,
                    error: null,
                  }),
                };
              },
            };
          },
          upsert(row: Row) {
            const key = String(row.email).toLowerCase();
            const next = { ...store.get(key), ...row, email: key };
            store.set(key, next);
            return {
              select() {
                return {
                  single: async () => ({ data: next, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "clients") {
        return {
          update(patch: Row) {
            return {
              eq(_col: string, email: string) {
                for (const c of clients) {
                  if (emailsMatch(c.email, email)) Object.assign(c, patch);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
          select() {
            return {
              eq: async (_c: string, email: string) => ({
                data: clients.filter((c) => emailsMatch(c.email, email)),
                error: null,
              }),
            };
          },
        };
      }
      if (table === "techs") {
        return {
          select() {
            return {
              ilike: async (_c: string, email: string) => ({
                data: techs.filter((t) => emailsMatch(t.email, email)),
                error: null,
              }),
            };
          },
          update(patch: Row) {
            return {
              eq(_c: string, id: string) {
                for (const t of techs) {
                  if (t.id === id) Object.assign(t, patch);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "staff_members") {
        return {
          select() {
            return {
              ilike: async (_c: string, email: string) => ({
                data: staff.filter((s) => emailsMatch(s.email, email)),
                error: null,
              }),
            };
          },
          update(patch: Row) {
            return {
              eq(_c: string, id: string) {
                for (const s of staff) {
                  if (s.id === id) Object.assign(s, patch);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "outbound_sends") {
        return {
          insert: async (row: Row) => {
            opsSends.push(row);
            return { error: null };
          },
          update() {
            return {
              eq() {
                return {
                  select() {
                    return {
                      maybeSingle: async () => ({ data: { id: "out_1" }, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      return {};
    },
  };

  return { sb, store, clients, techs, staff, opsSends };
}

describe("email suppression helpers", () => {
  it("normalises addresses", () => {
    expect(normaliseEmail("  Sophie@Glow-UK.com ")).toBe("sophie@glow-uk.com");
  });

  it("classifies Permanent as hard and Transient as soft", () => {
    expect(classifyBounce("Permanent")).toBe("hard");
    expect(classifyBounce("Transient")).toBe("soft");
    expect(classifyBounce("Temporary")).toBe("soft");
    expect(classifyBounce(null)).toBe("hard");
  });

  it("soft bounce only suppresses after the third consecutive failure", () => {
    const first = applySoftBounceCount({
      consecutiveSoftFailures: 0,
      suppressed: false,
      permanent: false,
    });
    expect(first).toEqual({ action: "count", consecutiveSoftFailures: 1, suppressed: false });

    const second = applySoftBounceCount({
      consecutiveSoftFailures: 1,
      suppressed: false,
      permanent: false,
    });
    expect(second).toEqual({ action: "count", consecutiveSoftFailures: 2, suppressed: false });

    const third = applySoftBounceCount({
      consecutiveSoftFailures: 2,
      suppressed: false,
      permanent: false,
    });
    expect(third).toEqual({
      action: "suppress",
      consecutiveSoftFailures: 3,
      suppressed: true,
      reason: "soft_bounce",
    });
  });
});

describe("clientEmailDeliveryBadge", () => {
  it("shows bouncing warning before full suppression", () => {
    expect(clientEmailDeliveryBadge({ emailSoftBounceCount: 2 })).toEqual({
      tone: "amber",
      label: "This client's email is bouncing",
    });
  });

  it("shows suppressed status when blocked", () => {
    expect(
      clientEmailDeliveryBadge({ emailSuppressed: true, emailSuppressionReason: "hard_bounce" }),
    ).toMatchObject({ tone: "red" });
  });
});

describe("accountEmailDeliveryWarning", () => {
  it("shows the dashboard copy when flagged", () => {
    expect(accountEmailDeliveryWarning({ emailDeliveryIssue: true })).toBe(
      "We're having trouble delivering email to your address",
    );
    expect(accountEmailDeliveryWarning({ emailDeliveryIssue: false })).toBeNull();
    expect(accountEmailDeliveryWarning(null)).toBeNull();
  });
});

describe("Resend webhook + sendEmail suppression wiring", () => {
  it("webhook handles bounced, complained, and delayed events", () => {
    const route = read("app/api/resend/webhook/route.ts");
    expect(route).toContain("email.bounced");
    expect(route).toContain("email.complained");
    expect(route).toContain("email.delivery_delayed");
    expect(route).toContain("applyHardBounce");
    expect(route).toContain("applySoftBounce");
    expect(route).toContain("applyComplaint");
    expect(route).toContain("markOutboundDelivery");
    expect(route).toContain("RESEND_EVENTS_WEBHOOK_SECRET");
    expect(route).toContain("accountProtected");
  });

  it("migration adds suppressions table and outbound resend id", () => {
    const sql = read("supabase/migrations/0052_email_suppressions.sql");
    expect(sql).toContain("email_suppressions");
    expect(sql).toContain("resendEmailId");
    expect(sql).toContain("emailSuppressed");
  });

  it("migration 0053 flags tech/staff delivery issues without suppression", () => {
    const sql = read("supabase/migrations/0053_tech_email_delivery_issue.sql");
    expect(sql).toContain("emailDeliveryIssue");
    expect(sql).toContain("techs");
    expect(sql).toContain("staff_members");
  });

  it("sendEmail checks suppression before calling Resend", () => {
    const email = read("lib/email.ts");
    expect(email).toContain("isEmailSuppressed");
    expect(email).toContain("suppressed_skip");
    expect(email).toContain("resendEmailId");
  });

  it("dashboard shell shows the delivery warning banner", () => {
    const shell = read("components/dashboard/dashboard-shell.tsx");
    expect(shell).toContain("accountEmailDeliveryWarning");
    expect(shell).toContain("role=\"alert\"");
    expect(read("lib/email-delivery-ui.ts")).toContain(
      "We're having trouble delivering email to your address",
    );
  });

  it("cron reconciles wrongly suppressed account emails", () => {
    const ops = read("lib/owner/ops.ts");
    expect(ops).toContain("reconcileSuppressedAccountEmails");
  });
});

describe("bounce webhook suppresses and skips later sends", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("hard bounce suppresses the address; sendEmail then skips", async () => {
    const { sb, clients } = makeSb({
      clients: [{ id: "cli_1", techId: "tech_1", email: "bounce@salon.test" }],
    });

    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => sb,
    }));
    vi.doMock("@/lib/db/queries", () => ({
      createAuditEvent: vi.fn(async () => undefined),
    }));

    const send = vi.fn(async () => ({ data: { id: "re_abc" }, error: null }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));

    const { applyHardBounce, isEmailSuppressed } = await import("@/lib/email-suppression");
    const result = await applyHardBounce(sb as never, {
      email: "Bounce@Salon.Test",
      resendEmailId: "re_1",
    });
    expect(result.suppressed).toBe(true);
    expect(result.accountProtected).toBe(false);
    expect(await isEmailSuppressed(sb as never, "bounce@salon.test")).toBe(true);
    expect(clients[0].emailSuppressed).toBe(true);

    const { sendEmail } = await import("@/lib/email");
    const ok = await sendEmail({
      to: "bounce@salon.test",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("complaint sets marketing opt-out and suppresses", async () => {
    const { sb, clients } = makeSb({
      clients: [
        { id: "cli_2", techId: "tech_1", email: "spam@salon.test", marketingOptOut: false },
      ],
    });
    vi.doMock("@/lib/db/queries", () => ({
      createAuditEvent: vi.fn(async () => undefined),
    }));
    const { applyComplaint } = await import("@/lib/email-suppression");
    await applyComplaint(sb as never, { email: "spam@salon.test" });
    expect(clients[0].marketingOptOut).toBe(true);
    expect(clients[0].emailSuppressed).toBe(true);
    expect(clients[0].emailSuppressionReason).toBe("complaint");
  });

  it("soft bounce suppresses only on the third failure", async () => {
    const { sb, clients } = makeSb({
      clients: [{ id: "cli_3", techId: "tech_1", email: "soft@salon.test" }],
    });

    const { applySoftBounce } = await import("@/lib/email-suppression");
    const one = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(one.suppression!.suppressed).toBe(false);
    expect(one.suppression!.consecutiveSoftFailures).toBe(1);

    const two = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(two.suppression!.suppressed).toBe(false);
    expect(two.suppression!.consecutiveSoftFailures).toBe(2);

    const three = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(three.suppression!.suppressed).toBe(true);
    expect(three.newlySuppressed).toBe(true);
    expect(three.suppression!.consecutiveSoftFailures).toBe(3);
    expect(clients[0].emailSuppressed).toBe(true);
  });
});

describe("tech/staff addresses are never auto-suppressed", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
    process.env.OPS_ALERT_EMAIL = "support@glow-uk.com";
  });

  it("hard bounce on a tech address flags and alerts but does not suppress", async () => {
    const opsSends: Row[] = [];
    const { sb, store, techs } = makeSb({
      techs: [
        {
          id: "tech_owner",
          email: "allurebeautydevizes@gmail.com",
          businessName: "Allure Beauty",
          name: "Owner",
          handle: "allure",
          emailDeliveryIssue: false,
        },
      ],
      clients: [
        {
          id: "cli_same",
          techId: "other",
          email: "allurebeautydevizes@gmail.com",
        },
      ],
      opsSends,
    });

    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => sb,
    }));
    const send = vi.fn(async () => ({ data: { id: "re_ops" }, error: null }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));

    const { applyHardBounce, isEmailSuppressed } = await import("@/lib/email-suppression");
    const result = await applyHardBounce(sb as never, {
      email: "AllureBeautyDevizes@gmail.com",
      resendEmailId: "re_bounce",
    });

    expect(result.suppressed).toBe(false);
    expect(result.accountProtected).toBe(true);
    expect(store.get("allurebeautydevizes@gmail.com")?.suppressed).not.toBe(true);
    expect(techs[0].emailDeliveryIssue).toBe(true);
    expect(techs[0].emailDeliveryIssueReason).toBe("hard_bounce");
    expect(await isEmailSuppressed(sb as never, "allurebeautydevizes@gmail.com")).toBe(false);

    // Ops alert fired to support.
    expect(send).toHaveBeenCalled();
    expect(String(send.mock.calls[0][0].to)).toContain("support@glow-uk.com");
    expect(String(send.mock.calls[0][0].subject)).toMatch(/Account email delivery issue/i);

    // Transactional sends to the owner still go out.
    const { sendEmail } = await import("@/lib/email");
    send.mockClear();
    const ok = await sendEmail({
      to: "allurebeautydevizes@gmail.com",
      subject: "New booking",
      html: "<p>Booked</p>",
      text: "Booked",
      kind: "booking_notify",
    });
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalled();
  });

  it("client bounce still suppresses as normal", async () => {
    const { sb, store, clients, techs } = makeSb({
      techs: [
        {
          id: "tech_owner",
          email: "owner@salon.test",
          businessName: "Salon",
          name: "Owner",
          handle: "salon",
        },
      ],
      clients: [{ id: "cli_c", techId: "tech_owner", email: "client@salon.test" }],
    });

    const { applyHardBounce, isEmailSuppressed } = await import("@/lib/email-suppression");
    const result = await applyHardBounce(sb as never, { email: "client@salon.test" });
    expect(result.suppressed).toBe(true);
    expect(result.accountProtected).toBe(false);
    expect(store.get("client@salon.test")?.suppressed).toBe(true);
    expect(clients[0].emailSuppressed).toBe(true);
    expect(techs[0].emailDeliveryIssue).toBeFalsy();
    expect(await isEmailSuppressed(sb as never, "client@salon.test")).toBe(true);
  });

  it("already-suppressed tech address is restored and ops is alerted", async () => {
    const store = new Map<string, Row>([
      [
        "owner@salon.test",
        {
          email: "owner@salon.test",
          suppressed: true,
          permanent: true,
          reason: "hard_bounce",
          consecutiveSoftFailures: 0,
        },
      ],
    ]);
    const { sb, techs } = makeSb({
      store,
      techs: [
        {
          id: "tech_1",
          email: "owner@salon.test",
          businessName: "Glow Salon",
          name: "Owner",
          handle: "glow",
          emailDeliveryIssue: false,
        },
      ],
      clients: [{ id: "cli_x", techId: "tech_1", email: "owner@salon.test", emailSuppressed: true }],
    });

    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => sb,
    }));
    const send = vi.fn(async () => ({ data: { id: "re_ops2" }, error: null }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));

    const { reconcileSuppressedAccountEmails, isEmailSuppressed } = await import(
      "@/lib/email-suppression"
    );
    const { restored } = await reconcileSuppressedAccountEmails(sb as never);
    expect(restored).toEqual(["owner@salon.test"]);
    expect(store.get("owner@salon.test")?.suppressed).toBe(false);
    expect(store.get("owner@salon.test")?.permanent).toBe(false);
    expect(techs[0].emailDeliveryIssue).toBe(true);
    expect(techs[0].emailDeliveryIssueReason).toBe("restored_from_suppression");
    expect(await isEmailSuppressed(sb as never, "owner@salon.test")).toBe(false);
    expect(send).toHaveBeenCalled();
    expect(String(send.mock.calls[0][0].to)).toContain("support@glow-uk.com");
  });

  it("staff email bounce flags the staff member without suppressing", async () => {
    const { sb, store, staff } = makeSb({
      staff: [
        {
          id: "st_1",
          techId: "tech_1",
          email: "stylist@salon.test",
          name: "Sam",
          emailDeliveryIssue: false,
        },
      ],
    });

    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => sb,
    }));
    const send = vi.fn(async () => ({ data: { id: "re_ops3" }, error: null }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));

    const { applyHardBounce, isEmailSuppressed } = await import("@/lib/email-suppression");
    const result = await applyHardBounce(sb as never, { email: "stylist@salon.test" });
    expect(result.accountProtected).toBe(true);
    expect(result.suppressed).toBe(false);
    expect(store.get("stylist@salon.test")?.suppressed).not.toBe(true);
    expect(staff[0].emailDeliveryIssue).toBe(true);
    expect(await isEmailSuppressed(sb as never, "stylist@salon.test")).toBe(false);
    expect(send).toHaveBeenCalled();
  });
});
