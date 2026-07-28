import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applySoftBounceCount,
  classifyBounce,
  normaliseEmail,
} from "@/lib/email-suppression";
import { clientEmailDeliveryBadge } from "@/lib/email-delivery-ui";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

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
  });

  it("migration adds suppressions table and outbound resend id", () => {
    const sql = read("supabase/migrations/0052_email_suppressions.sql");
    expect(sql).toContain("email_suppressions");
    expect(sql).toContain('resendEmailId');
    expect(sql).toContain("emailSuppressed");
  });

  it("sendEmail checks suppression before calling Resend", () => {
    const email = read("lib/email.ts");
    expect(email).toContain("isEmailSuppressed");
    expect(email).toContain("suppressed_skip");
    expect(email).toContain("resendEmailId");
  });
});

describe("bounce webhook suppresses and skips later sends", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("hard bounce suppresses the address; sendEmail then skips", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const clients: Record<string, unknown>[] = [
      { id: "cli_1", techId: "tech_1", email: "bounce@salon.test" },
    ];

    const sb = {
      from(table: string) {
        if (table === "email_suppressions") {
          return {
            select() {
              return {
                eq(_col: string, email: string) {
                  return {
                    maybeSingle: async () => ({ data: store.get(email) ?? null, error: null }),
                  };
                },
              };
            },
            upsert(row: Record<string, unknown>) {
              store.set(String(row.email), row);
              return {
                select() {
                  return {
                    single: async () => ({ data: row, error: null }),
                  };
                },
              };
            },
          };
        }
        if (table === "clients") {
          return {
            update(patch: Record<string, unknown>) {
              return {
                eq(_col: string, email: string) {
                  for (const c of clients) {
                    if (c.email === email) Object.assign(c, patch);
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
            select() {
              return {
                eq: async () => ({ data: clients, error: null }),
              };
            },
          };
        }
        if (table === "outbound_sends") {
          return {
            insert: async () => ({ error: null }),
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
    await applyHardBounce(sb as never, { email: "Bounce@Salon.Test", resendEmailId: "re_1" });
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
    const store = new Map<string, Record<string, unknown>>();
    const clients: Record<string, unknown>[] = [
      { id: "cli_2", techId: "tech_1", email: "spam@salon.test", marketingOptOut: false },
    ];
    const sb = {
      from(table: string) {
        if (table === "email_suppressions") {
          return {
            select() {
              return {
                eq(_c: string, email: string) {
                  return { maybeSingle: async () => ({ data: store.get(email) ?? null, error: null }) };
                },
              };
            },
            upsert(row: Record<string, unknown>) {
              store.set(String(row.email), row);
              return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
            },
          };
        }
        if (table === "clients") {
          return {
            update(patch: Record<string, unknown>) {
              return {
                eq(_c: string, email: string) {
                  for (const c of clients) {
                    if (c.email === email) Object.assign(c, patch);
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
            select() {
              return { eq: async () => ({ data: clients, error: null }) };
            },
          };
        }
        return {};
      },
    };
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
    const store = new Map<string, Record<string, unknown>>();
    const clients: Record<string, unknown>[] = [
      { id: "cli_3", techId: "tech_1", email: "soft@salon.test" },
    ];
    const sb = {
      from(table: string) {
        if (table === "email_suppressions") {
          return {
            select() {
              return {
                eq(_c: string, email: string) {
                  return { maybeSingle: async () => ({ data: store.get(email) ?? null, error: null }) };
                },
              };
            },
            upsert(row: Record<string, unknown>) {
              store.set(String(row.email), { ...store.get(String(row.email)), ...row });
              return {
                select: () => ({
                  single: async () => ({ data: store.get(String(row.email)), error: null }),
                }),
              };
            },
          };
        }
        if (table === "clients") {
          return {
            update(patch: Record<string, unknown>) {
              return {
                eq(_c: string, email: string) {
                  for (const c of clients) {
                    if (c.email === email) Object.assign(c, patch);
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        return {};
      },
    };

    const { applySoftBounce } = await import("@/lib/email-suppression");
    const one = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(one.suppression.suppressed).toBe(false);
    expect(one.suppression.consecutiveSoftFailures).toBe(1);

    const two = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(two.suppression.suppressed).toBe(false);
    expect(two.suppression.consecutiveSoftFailures).toBe(2);

    const three = await applySoftBounce(sb as never, { email: "soft@salon.test" });
    expect(three.suppression.suppressed).toBe(true);
    expect(three.newlySuppressed).toBe(true);
    expect(three.suppression.consecutiveSoftFailures).toBe(3);
    expect(clients[0].emailSuppressed).toBe(true);
  });
});
