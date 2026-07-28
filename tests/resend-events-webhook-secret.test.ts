import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("Resend webhook secret separation", () => {
  it("delivery webhook uses RESEND_EVENTS_WEBHOOK_SECRET only", () => {
    const route = read("app/api/resend/webhook/route.ts");
    expect(route).toContain("RESEND_EVENTS_WEBHOOK_SECRET");
    expect(route).not.toMatch(/process\.env\.RESEND_WEBHOOK_SECRET/);
    expect(route).toContain('status: 401');
    expect(route).toContain("[resend/webhook] signature failure");
  });

  it("inbound webhook still uses RESEND_WEBHOOK_SECRET", () => {
    const inbound = read("app/api/resend/inbound/route.ts");
    expect(inbound).toContain("RESEND_WEBHOOK_SECRET");
    expect(inbound).not.toContain("RESEND_EVENTS_WEBHOOK_SECRET");
  });

  it("env example documents both secrets and which webhook each belongs to", () => {
    const env = read(".env.example");
    expect(env).toContain("RESEND_WEBHOOK_SECRET");
    expect(env).toContain("/api/resend/inbound");
    expect(env).toContain("RESEND_EVENTS_WEBHOOK_SECRET");
    expect(env).toContain("/api/resend/webhook");
    expect(env).toMatch(/do not reuse/i);
  });

  it("README documents both webhook secrets", () => {
    const readme = read("README.md");
    expect(readme).toContain("RESEND_EVENTS_WEBHOOK_SECRET");
    expect(readme).toContain("/api/resend/webhook");
    expect(readme).toContain("/api/resend/inbound");
  });
});

describe("POST /api/resend/webhook auth + ack behaviour", () => {
  const originalEvents = process.env.RESEND_EVENTS_WEBHOOK_SECRET;
  const originalInbound = process.env.RESEND_WEBHOOK_SECRET;
  const originalApi = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_EVENTS_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    process.env.RESEND_API_KEY = "re_test";
  });

  afterEach(() => {
    if (originalEvents === undefined) delete process.env.RESEND_EVENTS_WEBHOOK_SECRET;
    else process.env.RESEND_EVENTS_WEBHOOK_SECRET = originalEvents;
    if (originalInbound === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = originalInbound;
    if (originalApi === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApi;
  });

  it("returns 401 when RESEND_EVENTS_WEBHOOK_SECRET is missing", async () => {
    // Even if inbound secret is set, events endpoint must not use it.
    process.env.RESEND_WEBHOOK_SECRET = "whsec_inbound_only";
    const { POST } = await import("@/app/api/resend/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/resend/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.endpoint).toBe("/api/resend/webhook");
    expect(String(body.reason)).toMatch(/RESEND_EVENTS_WEBHOOK_SECRET is missing/);
  });

  it("returns 401 when signature verification fails", async () => {
    process.env.RESEND_EVENTS_WEBHOOK_SECRET = "whsec_events";
    vi.doMock("resend", () => ({
      Resend: class {
        webhooks = {
          verify: () => {
            throw new Error("Invalid signature");
          },
        };
      },
    }));
    const { POST } = await import("@/app/api/resend/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/resend/webhook", {
        method: "POST",
        headers: {
          "svix-id": "msg_1",
          "svix-timestamp": "1",
          "svix-signature": "v1,bad",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.endpoint).toBe("/api/resend/webhook");
    expect(String(body.reason)).toMatch(/invalid signature/i);
  });

  it("returns 200 for a valid signed delivery event", async () => {
    process.env.RESEND_EVENTS_WEBHOOK_SECRET = "whsec_events";
    const markOutboundDelivery = vi.fn(async () => ({ id: "out_1" }));
    const applyHardBounce = vi.fn(async () => ({ suppressed: true }));
    vi.doMock("resend", () => ({
      Resend: class {
        webhooks = {
          verify: () => ({
            type: "email.bounced",
            data: {
              email_id: "re_1",
              to: ["bounce@salon.test"],
              bounce: { type: "Permanent", message: "mailbox unavailable" },
            },
          }),
        };
      },
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({}),
    }));
    vi.doMock("@/lib/email-suppression", () => ({
      applyComplaint: vi.fn(),
      applyHardBounce,
      applySoftBounce: vi.fn(),
      classifyBounce: () => "hard",
      markOutboundDelivery,
      normaliseEmail: (e: string) => e.trim().toLowerCase(),
    }));
    const { POST } = await import("@/app/api/resend/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/resend/webhook", {
        method: "POST",
        headers: {
          "svix-id": "msg_ok",
          "svix-timestamp": "1",
          "svix-signature": "v1,ok",
        },
        body: JSON.stringify({ type: "email.bounced" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.event).toBe("email.bounced");
    expect(applyHardBounce).toHaveBeenCalled();
  });

  it("returns 200 for unhandled event types so Resend does not retry", async () => {
    process.env.RESEND_EVENTS_WEBHOOK_SECRET = "whsec_events";
    vi.doMock("resend", () => ({
      Resend: class {
        webhooks = {
          verify: () => ({
            type: "email.opened",
            data: { email_id: "re_2", to: ["x@y.com"] },
          }),
        };
      },
    }));
    const { POST } = await import("@/app/api/resend/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/resend/webhook", {
        method: "POST",
        headers: {
          "svix-id": "msg_skip",
          "svix-timestamp": "1",
          "svix-signature": "v1,ok",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, skipped: "email.opened" });
  });
});
