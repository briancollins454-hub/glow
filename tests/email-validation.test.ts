import { describe, expect, it, vi, beforeEach } from "vitest";
import { isValidEmail, sanitiseImportContact } from "@/lib/email";

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    expect(isValidEmail("sophie@glow-uk.com")).toBe(true);
    expect(isValidEmail("a.b+tag@mail.co.uk")).toBe(true);
  });

  it("rejects comma pairs, phones, missing-dot domains, placeholders, and whitespace", () => {
    expect(isValidEmail("a@b.com, c@d.com")).toBe(false);
    expect(isValidEmail("07700900111")).toBe(false);
    expect(isValidEmail("+447700900111")).toBe(false);
    expect(isValidEmail("user@localhost")).toBe(false);
    expect(isValidEmail("user@example.com")).toBe(false);
    expect(isValidEmail("user@example.org")).toBe(false);
    expect(isValidEmail("user@example.net")).toBe(false);
    expect(isValidEmail("user@test.com")).toBe(false);
    expect(isValidEmail(" spaced@glow-uk.com")).toBe(false);
    expect(isValidEmail("spaced @glow-uk.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("sanitiseImportContact", () => {
  it("keeps the first valid token from a comma-separated email field", () => {
    const r = sanitiseImportContact("bad, sophie@glow-uk.com, other@x.com", "");
    expect(r.email).toBe("sophie@glow-uk.com");
    expect(r.emailInvalid).toBe(false);
  });

  it("moves a phone stuffed into email when phone is empty", () => {
    const r = sanitiseImportContact("07700900111", "");
    expect(r.email).toBe("");
    expect(r.phone).toBe("07700900111");
    expect(r.emailInvalid).toBe(true);
  });

  it("blanks invalid emails", () => {
    const r = sanitiseImportContact("user@example.com", "07700900111");
    expect(r.email).toBe("");
    expect(r.phone).toBe("07700900111");
    expect(r.emailInvalid).toBe(true);
  });
});

describe("sendEmail skips invalid recipients", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("returns false without calling Resend for an invalid address", async () => {
    const send = vi.fn();
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send };
      },
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      supabaseService: () => ({ from: () => ({ insert: async () => ({}) }) }),
    }));
    const { sendEmail } = await import("@/lib/email");
    const ok = await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
