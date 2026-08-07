import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CLIENT_EMAIL_KINDS, clientFromAddress, platformReplyTo } from "@/lib/email";

const ROOT = resolve(__dirname, "..");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsFiles(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("every client-facing send carries a replyTo", () => {
  const clientKinds = new Set<string>(CLIENT_EMAIL_KINDS);

  it("no bare sendEmail anywhere uses a client-facing kind (client mail must go through sendClientEmail)", () => {
    const files = [...walkTsFiles(join(ROOT, "lib")), ...walkTsFiles(join(ROOT, "app"))];
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Bare sendEmail calls only — sendClientEmail is the enforced path.
      const re = /(?<!Client)sendEmail\(\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const block = src.slice(m.index, m.index + 800);
        const kind = block.match(/kind:\s*"([^"]+)"/)?.[1];
        if (kind && clientKinds.has(kind)) {
          offenders.push(`${file.replace(ROOT + "/", "")} → kind "${kind}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("notify.ts sends all client-facing mail via sendClientEmail; bare sendEmail only for salon mail", () => {
    const src = readFileSync(join(ROOT, "lib/notify.ts"), "utf8");
    // Client-facing conversions present.
    for (const kind of [
      "client_message",
      "patch_retest",
      "aftercare",
      "review_request",
      "booking_approved",
      "booking_declined",
      "reaction_checkin",
      "infill_nudge",
      "late_cascade",
      "precare",
    ]) {
      const idx = src.indexOf(`kind: "${kind}"`);
      expect(idx, `kind "${kind}" missing from notify.ts`).toBeGreaterThan(-1);
      const before = src.slice(Math.max(0, idx - 900), idx);
      expect(before, `kind "${kind}" must be sent via sendClientEmail`).toContain(
        "sendClientEmail({",
      );
    }
    // The reminder paths (confirmation / reminder_24h / reminder_2h /
    // balance_request / patch_test_retest use a dynamic kind) also converted.
    expect(src).toMatch(/idempotencyKey: `reminder\/\$\{reminder\.id\}`[\s\S]{0,120}kind: reminder\.kind/);
    expect(src.match(/sendClientEmail\(\{\s*\n\s*tech,/g)?.length).toBeGreaterThanOrEqual(12);
    // Remaining bare sendEmail calls are salon/tech-facing only.
    const bare = [...src.matchAll(/(?<!Client)sendEmail\(\{[\s\S]{0,800}?kind: "([^"]+)"/g)].map((m) => m[1]);
    expect(bare.sort()).toEqual(
      ["booking_notify", "booking_request", "reaction_checkin_report", "tech_message"].sort(),
    );
  });

  it("waitlist and rebooking nudges go through sendClientEmail", () => {
    for (const file of ["lib/waitlist.ts", "lib/rebooking.ts"]) {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src).toContain("sendClientEmail({");
      expect(src).not.toMatch(/(?<!Client)sendEmail\(\{/);
    }
  });
});

describe("clientFromAddress", () => {
  it("shows the salon name on the verified Glow address", () => {
    const from = clientFromAddress("Allure Beauty");
    expect(from).toMatch(/^Allure Beauty via Glow <.+@.+>$/);
  });

  it("strips header-breaking characters from the business name", () => {
    const from = clientFromAddress('Bella "Rose"\r\n<evil@x.com>,;');
    expect(from).not.toContain('"');
    expect(from).not.toContain("\n");
    expect(from).toMatch(/^Bella Rose evil@x\.com via Glow </);
  });

  it("falls back to the plain Glow from when there is no business name", () => {
    expect(clientFromAddress("")).not.toContain("via Glow");
    expect(clientFromAddress(null)).not.toContain("via Glow");
  });
});

describe("sendClientEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    const send = vi.fn().mockResolvedValue({ data: { id: "email_1" }, error: null });
    const inserted: Record<string, unknown>[] = [];
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({
        from: () => ({
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        }),
      }),
    }));
    // Kill switches off for the test.
    vi.doMock("@/lib/owner/controls", () => ({
      outboundBlockReason: async () => null,
    }));
    const email = await import("@/lib/email");
    return { send, inserted, email };
  }

  it("always sets replyTo to the salon's email and a salon-branded from", async () => {
    const { send, inserted, email } = await setup();
    const ok = await email.sendClientEmail({
      tech: { id: "tech_1", email: "salon@allurebeauty.co.uk", businessName: "Allure Beauty" },
      to: "client@gmail.com",
      subject: "Your booking is confirmed",
      html: "<p>Hi</p>",
      text: "Hi",
      kind: "confirmation",
    });
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.replyTo).toBe("salon@allurebeauty.co.uk");
    expect(payload.from).toMatch(/^Allure Beauty via Glow </);
    // replyTo is recorded on outbound_sends for audits.
    expect(inserted[0]?.replyTo).toBe("salon@allurebeauty.co.uk");
    expect(inserted[0]?.techId).toBe("tech_1");
  });

  it("falls back to the platform replyTo and warns when the salon has no email on file", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { send, email } = await setup();
    const ok = await email.sendClientEmail({
      tech: { id: "tech_1", email: "", businessName: "Allure Beauty" },
      to: "client@gmail.com",
      subject: "Reminder",
      html: "<p>Hi</p>",
      text: "Hi",
      kind: "reminder_24h",
    });
    expect(ok).toBe(true);
    const payload = send.mock.calls[0][0];
    expect(payload.replyTo).toBe(email.platformReplyTo());
    expect(payload.replyTo).toBeTruthy();
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("platform replyTo")),
    ).toBe(true);
  });

  it("falls back when the tech row could not be loaded, still logging the techId", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { send, inserted, email } = await setup();
    await email.sendClientEmail({
      tech: null,
      techId: "tech_fallback",
      to: "client@gmail.com",
      subject: "Reminder",
      html: "<p>Hi</p>",
      text: "Hi",
      kind: "reminder_2h",
    });
    expect(send.mock.calls[0][0].replyTo).toBe(email.platformReplyTo());
    expect(inserted[0]?.techId).toBe("tech_fallback");
    expect(warn).toHaveBeenCalled();
  });

  it("platform replyTo is a real address", () => {
    expect(platformReplyTo()).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});

describe("inbound replies route to the matched salon", () => {
  it("forwards to the salon matched by client/booking, platform inbox only when unmatched", () => {
    const src = readFileSync(join(ROOT, "app/api/resend/inbound/route.ts"), "utf8");
    expect(src).toContain("matchSalonForSender");
    expect(src).toMatch(/from\("clients"\)/);
    expect(src).toMatch(/from\("bookings"\)/);
    expect(src).toContain("salon?.email ?? SUPPORT_FORWARD_TO");
    expect(src).toContain("forwardedTo");
    expect(src).toContain("matchedTechId");
  });
});
