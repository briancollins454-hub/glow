import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLATFORM_OWNER_EMAIL,
  isPlatformOwnerEmail,
  isPlatformOwner,
  isAdminTech,
} from "@/lib/admin";
import { isAccountBlocked } from "@/lib/owner/account-moderation";
import { acceptsOnlineBookings } from "@/lib/subscriptions";

describe("platform owner exclusivity", () => {
  it("hard-codes brian@thesupportsdesk.com for block/delete", () => {
    expect(PLATFORM_OWNER_EMAIL).toBe("brian@thesupportsdesk.com");
    expect(isPlatformOwnerEmail("brian@thesupportsdesk.com")).toBe(true);
    expect(isPlatformOwnerEmail("Brian@TheSupportsDesk.com")).toBe(true);
    expect(isPlatformOwnerEmail("other@example.com")).toBe(false);
    expect(isPlatformOwner({ email: "brian@thesupportsdesk.com" })).toBe(true);
    expect(isPlatformOwner({ email: "staff@example.com" })).toBe(false);
  });

  it("requirePlatformOwner is used by block/unblock/delete actions", () => {
    const actions = readFileSync(
      join(process.cwd(), "app/dashboard/admin/owner-actions.ts"),
      "utf8",
    );
    expect(actions).toContain("requirePlatformOwner");
    expect(actions).toContain("ownerBlockAccountAction");
    expect(actions).toContain("ownerUnblockAccountAction");
    expect(actions).toContain("ownerDeleteAccountAction");
    expect(actions).toContain("admin_blocked_account");
    expect(actions).toContain("admin_deleted_account");
  });

  it("admin console UI only shows moderation to platform owner", () => {
    const page = readFileSync(
      join(process.cwd(), "app/dashboard/admin/accounts/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("isPlatformOwner");
    expect(page).toContain("Block account");
    expect(page).toContain("Delete forever");
    expect(page).toContain("ownerBlockAccountAction");
  });

  it("isAdminTech still defaults to the same owner email", () => {
    expect(isAdminTech({ email: "brian@thesupportsdesk.com" })).toBe(true);
  });
});

describe("blocked account enforcement", () => {
  it("isAccountBlocked reads blockedAt", () => {
    expect(isAccountBlocked({ blockedAt: null })).toBe(false);
    expect(isAccountBlocked({ blockedAt: "2026-07-29T12:00:00.000Z" })).toBe(true);
  });

  it("blocked accounts never accept online bookings", () => {
    expect(
      acceptsOnlineBookings({
        subscriptionStatus: "active",
        bookingPageLive: true,
        blockedAt: "2026-07-29T12:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      acceptsOnlineBookings({
        subscriptionStatus: "active",
        bookingPageLive: true,
        blockedAt: null,
      }),
    ).toBe(true);
  });

  it("login signs out blocked accounts", () => {
    const actions = readFileSync(join(process.cwd(), "app/(auth)/actions.ts"), "utf8");
    expect(actions).toContain("blockedAt");
    expect(actions).toContain("/login?error=blocked");
    const login = readFileSync(join(process.cwd(), "app/(auth)/login/page.tsx"), "utf8");
    expect(login).toContain('error === "blocked"');
  });

  it("dashboard session rejects blocked techs and their staff", () => {
    const session = readFileSync(join(process.cwd(), "lib/auth/session.ts"), "utf8");
    expect(session).toContain("blockedAt");
  });

  it("migration adds blocked columns", () => {
    const mig = readFileSync(
      join(process.cwd(), "supabase/migrations/0057_owner_block_accounts.sql"),
      "utf8",
    );
    expect(mig).toContain('"blockedAt"');
    expect(mig).toContain('"blockedReason"');
    expect(mig).toContain('"blockedByEmail"');
  });

  it("delete requires typing the handle and cancels Stripe", () => {
    const mod = readFileSync(join(process.cwd(), "lib/owner/account-moderation.ts"), "utf8");
    expect(mod).toContain("subscriptions.cancel");
    expect(mod).toContain("Cannot delete the platform owner account");
    expect(mod).toContain("Cannot block the platform owner account");
    const actions = readFileSync(
      join(process.cwd(), "app/dashboard/admin/owner-actions.ts"),
      "utf8",
    );
    expect(actions).toContain("confirm_handle");
    expect(actions).toMatch(/typed !== target\.handle/);
  });
});
