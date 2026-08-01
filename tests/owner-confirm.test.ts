import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountsReturnWith,
  escapeForPre,
  isConfirmed,
  ownerNudgeBody,
  ownerNudgeSubject,
} from "@/lib/owner/confirm";
import { makeTech } from "./fixtures";

describe("isConfirmed", () => {
  function fd(confirm: string) {
    const form = new FormData();
    form.set("confirm", confirm);
    return form;
  }

  it("accepts yes in any common mobile casing / spacing", () => {
    expect(isConfirmed(fd("yes"))).toBe(true);
    expect(isConfirmed(fd("Yes"))).toBe(true);
    expect(isConfirmed(fd("YES"))).toBe(true);
    expect(isConfirmed(fd(" yes "))).toBe(true);
  });

  it("rejects empty and wrong values", () => {
    expect(isConfirmed(fd(""))).toBe(false);
    expect(isConfirmed(fd("no"))).toBe(false);
    expect(isConfirmed(new FormData())).toBe(false);
  });

  it("compares against a custom expected value case-insensitively", () => {
    expect(isConfirmed(fd("MyHandle"), "myhandle")).toBe(true);
    expect(isConfirmed(fd("myhandle"), "MyHandle")).toBe(true);
    expect(isConfirmed(fd("yes"), "myhandle")).toBe(false);
  });
});

describe("owner nudge copy", () => {
  it("derives subject from kind", () => {
    expect(ownerNudgeSubject("setup_help")).toBe("Need a hand getting set up?");
    expect(ownerNudgeSubject("go_live")).toBe("Ready to go live?");
    expect(ownerNudgeSubject("win_back")).toBe("We would love you back");
    expect(ownerNudgeSubject("trial_nudge")).toBe("Your Glow trial");
  });

  it("builds body from the typed note", () => {
    expect(ownerNudgeBody("Sam", "Come finish your services list.")).toBe(
      "Hi Sam,\n\nCome finish your services list.\n\nBrian",
    );
  });

  it("escapes note content for the HTML <pre> block", () => {
    expect(escapeForPre('Hi <script> & "x"')).toBe("Hi &lt;script&gt; &amp; \"x\"");
  });
});

describe("accountsReturnWith", () => {
  it("keeps filters and appends the error", () => {
    expect(accountsReturnWith("/dashboard/admin/accounts?status=trialing&q=amy", "err", "confirm")).toBe(
      "/dashboard/admin/accounts?status=trialing&q=amy&err=confirm",
    );
  });

  it("falls back to the list root for unsafe returnTo", () => {
    expect(accountsReturnWith("https://evil.example/phish", "err", "confirm")).toBe(
      "/dashboard/admin/accounts?err=confirm",
    );
  });
});

// ---- bulk nudge uses the submitted note ------------------------------------

const emails: Array<{ to: string; subject: string; text: string; kind?: string }> = [];
const notes: Array<{ techId: string; body: string }> = [];
const tech = makeTech({
  id: "tech_nudge_1",
  email: "sam@example.com",
  name: "Sam",
  businessName: "Sam's Nails",
});

vi.mock("@/lib/owner/require-owner", () => ({
  requireOwner: async () => ({ tech: makeTech({ email: "brian@thesupportsdesk.com" }), role: "owner" }),
  ownerSb: () => ({
    from: () => ({
      insert: async (row: { techId: string; body: string }) => {
        notes.push({ techId: row.techId, body: row.body });
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/lib/owner/view-as", () => ({
  assertNotViewAs: async () => undefined,
}));

vi.mock("@/lib/owner/owner-audit-log", () => ({
  writeOwnerAudit: async () => undefined,
}));

vi.mock("@/lib/owner/broadcast", () => ({
  assertNotBulkDelete: () => undefined,
  createBroadcastPreview: vi.fn(),
  sendBroadcast: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getTechById: async () => tech,
  updateTech: async () => undefined,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: async (opts: { to: string; subject: string; text: string; kind?: string }) => {
    emails.push(opts);
    return true;
  },
}));

vi.mock("@/lib/owner/digest", () => ({
  sendOwnerWeeklyDigest: async () => ({ ok: true }),
}));

vi.mock("@/lib/owner/saved-views", () => ({
  saveView: vi.fn(),
  deleteSavedView: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
}));

describe("bulkOwnerAction nudge branch", () => {
  beforeEach(() => {
    emails.length = 0;
    notes.length = 0;
  });

  it("sends the typed note as the email body and records it on the owner_notes row", async () => {
    const { bulkOwnerAction } = await import("@/app/dashboard/admin/phase4-actions");
    const form = new FormData();
    form.set("confirm", "Yes");
    form.set("bulkAction", "nudge");
    form.set("kind", "setup_help");
    form.set("note", "Come finish your services list when you can.");
    form.set("ids", tech.id);
    form.set("returnTo", "/dashboard/admin/accounts?status=trialing");

    await expect(bulkOwnerAction(form)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toBe("Need a hand getting set up?");
    expect(emails[0]!.kind).toBe("owner_setup_help");
    expect(emails[0]!.text).toContain("Come finish your services list when you can.");
    expect(emails[0]!.text).toMatch(/^Hi Sam,/);
    expect(emails[0]!.text).toMatch(/Brian$/);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.body).toBe("Come finish your services list when you can.");
  });

  it("redirects with err=note when the note is empty", async () => {
    const { bulkOwnerAction } = await import("@/app/dashboard/admin/phase4-actions");
    const form = new FormData();
    form.set("confirm", "yes");
    form.set("bulkAction", "nudge");
    form.set("kind", "go_live");
    form.set("note", "   ");
    form.set("ids", tech.id);
    form.set("returnTo", "/dashboard/admin/accounts?status=trialing");

    await expect(bulkOwnerAction(form)).rejects.toThrow(
      /NEXT_REDIRECT:\/dashboard\/admin\/accounts\?status=trialing&err=note/,
    );
    expect(emails).toHaveLength(0);
  });

  it("preserves filters on a failed confirm", async () => {
    const { bulkOwnerAction } = await import("@/app/dashboard/admin/phase4-actions");
    const form = new FormData();
    form.set("confirm", "YES!"); // not exact "yes"
    form.set("bulkAction", "nudge");
    form.set("note", "hello");
    form.set("ids", tech.id);
    form.set("returnTo", "/dashboard/admin/accounts?status=trialing&q=amy");

    await expect(bulkOwnerAction(form)).rejects.toThrow(
      /NEXT_REDIRECT:\/dashboard\/admin\/accounts\?status=trialing&q=amy&err=confirm/,
    );
  });
});
