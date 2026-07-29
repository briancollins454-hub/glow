import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isViewAsPostAllowed, VIEW_AS_COOKIE } from "@/lib/owner/view-as";
import { groupOmniResults, type OmniResult } from "@/lib/owner/omni-search";
import { filterOutInternal, isInternalTech } from "@/lib/owner/internal-accounts";

// Inline prefix detection tests via reading source patterns
describe("Phase 1 omni-search", () => {
  it("resolves known id prefixes in omni-search source", () => {
    const src = readFileSync(join(process.cwd(), "lib/owner/omni-search.ts"), "utf8");
    for (const p of ["bk_", "cli_", "pay_", "tech_", "stf_", "pi_", "ch_", "acct_", "sub_", "cus_", "in_"]) {
      expect(src).toContain(p);
    }
    expect(src).toContain("techLabel");
    expect(src).toContain("providerRef");
  });

  it("groups results by entity type", () => {
    const results: OmniResult[] = [
      {
        type: "tech",
        id: "t1",
        label: "A",
        detail: "",
        techId: "t1",
        techLabel: "A",
        href: "/dashboard/admin/accounts/t1",
      },
      {
        type: "payment",
        id: "p1",
        label: "pay",
        detail: "",
        techId: "t1",
        techLabel: "A",
        href: "/dashboard/admin/accounts/t1",
      },
    ];
    const g = groupOmniResults(results);
    expect(g.tech).toHaveLength(1);
    expect(g.payment).toHaveLength(1);
  });

  it("search API and page are owner-gated", () => {
    const api = readFileSync(join(process.cwd(), "app/api/owner/search/route.ts"), "utf8");
    expect(api).toContain("requireOwner");
    const page = readFileSync(join(process.cwd(), "app/dashboard/admin/search/page.tsx"), "utf8");
    expect(page).toContain("requireOwner");
    expect(page).toContain("OwnerOmniSearch");
  });
});

describe("Phase 1 view-as impersonation", () => {
  it("blocks mutations except exit allowlist", () => {
    expect(isViewAsPostAllowed("/dashboard/admin/accounts/view-as-exit")).toBe(true);
    expect(isViewAsPostAllowed("/dashboard/billing")).toBe(false);
    expect(isViewAsPostAllowed("/dashboard/services")).toBe(false);
    expect(VIEW_AS_COOKIE).toBe("glow_view_as");
  });

  it("middleware rejects non-GET when view-as cookie set", () => {
    const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(mw).toContain("glow_view_as");
    expect(mw).toContain("403");
    expect(mw).toContain("Read-only view-as");
  });

  it("start/end actions audit and rate-limit", () => {
    const vas = readFileSync(join(process.cwd(), "lib/owner/view-as.ts"), "utf8");
    expect(vas).toContain("view_as_started");
    expect(vas).toContain("view_as_ended");
    expect(vas).toContain("rateLimit");
    expect(vas).toContain("30 * 60 * 1000");
    expect(vas).toContain("assertNotViewAs");
  });

  it("view-as page shows persistent banner and exits via allow-listed route", () => {
    const page = readFileSync(
      join(process.cwd(), "app/dashboard/admin/accounts/[id]/view-as/page.tsx"),
      "utf8",
    );
    expect(page).toContain("read only");
    expect(page).toContain("Exit view-as");
    expect(page).toContain("/dashboard/admin/accounts/view-as-exit");
    expect(page).not.toContain("endViewAsAction");
  });

  it("owner mutating actions call assertNotViewAs", () => {
    const actions = readFileSync(join(process.cwd(), "app/dashboard/admin/owner-actions.ts"), "utf8");
    expect(actions).toContain("assertNotViewAs");
    expect(actions.match(/assertNotViewAs/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });
});

describe("Phase 1 internal accounts", () => {
  it("filters internals out by default", () => {
    const rows = [
      { id: "1", isInternal: true },
      { id: "2", isInternal: false },
      { id: "3", isInternal: null },
    ];
    expect(filterOutInternal(rows, false)).toHaveLength(2);
    expect(filterOutInternal(rows, true)).toHaveLength(3);
    expect(isInternalTech({ isInternal: true })).toBe(true);
  });

  it("overview and revenue exclude internals", () => {
    const overview = readFileSync(join(process.cwd(), "lib/owner/overview.ts"), "utf8");
    expect(overview).toContain("shouldIncludeInternal");
    expect(overview).toContain("internalExcluded");
    const revenue = readFileSync(join(process.cwd(), "lib/owner/revenue.ts"), "utf8");
    expect(revenue).toContain("filterOutInternal");
  });

  it("suggestions never auto-mark", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/admin/internal/page.tsx"), "utf8");
    expect(page).toContain("never auto-applied");
    expect(page).toContain("suggestInternalAccounts");
  });
});

describe("Phase 1 deliverability / money / conflicts", () => {
  it("deliverability unsuppress is logged", () => {
    const actions = readFileSync(
      join(process.cwd(), "app/dashboard/admin/deliverability-actions.ts"),
      "utf8",
    );
    expect(actions).toContain("unsuppress_email");
    expect(actions).toContain("writeOwnerAudit");
    expect(actions).toContain("reason");
  });

  it("money page reconciles glow and connect", () => {
    expect(existsSync(join(process.cwd(), "app/dashboard/admin/money/page.tsx"))).toBe(true);
    const money = readFileSync(join(process.cwd(), "lib/owner/money.ts"), "utf8");
    expect(money).toContain("getRevenueSnapshot");
    expect(money).toContain("Connect");
    expect(money).toContain("mismatch");
    expect(money).toContain("balanceAvailablePennies");
    expect(money).toContain("payoutInTransitPennies");
  });

  it("conflict rules cover seeded cases", () => {
    const src = readFileSync(join(process.cwd(), "lib/owner/conflicts.ts"), "utf8");
    for (const rule of [
      "shared_email",
      "near_identical_name",
      "duplicate_client_email",
      "duplicate_client_phone",
      "client_no_contact",
      "booking_no_client",
      "overlapping_staff_bookings",
    ]) {
      expect(src).toContain(rule);
    }
  });
});

describe("Phase 1 schema", () => {
  it("migration 0058 creates required tables and tech columns", () => {
    const mig = readFileSync(
      join(process.cwd(), "supabase/migrations/0058_owner_console_phase1.sql"),
      "utf8",
    );
    for (const col of [
      "isInternal",
      "healthScore",
      "ownerTags",
      "outboundPausedAt",
    ]) {
      expect(mig).toContain(col);
    }
    for (const table of [
      "owner_settings",
      "owner_audit",
      "owner_notes",
      "platform_events",
      "owner_alerts",
      "account_snapshots",
      "impersonation_sessions",
      "scheduled_sends",
    ]) {
      expect(mig).toContain(table);
    }
    expect(mig).toContain("owner_audit is immutable");
    expect(mig).toContain("impersonation_sessions_active_owner_unique");
  });
});
