import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { filtersToSearchParams, DEFAULT_ACCOUNT_COLUMNS } from "@/lib/owner/saved-views";
import { renderBroadcastPreview } from "@/lib/owner/broadcast";
import { RUNBOOKS, runbookForAlertRule } from "@/lib/owner/runbooks";
import { assertNotBulkDelete } from "@/lib/owner/broadcast";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 4 metric drill-down", () => {
  it("MetricTile supports href and overview wires account statuses", () => {
    const tile = read("components/owner/metric-tile.tsx");
    expect(tile).toContain("href");
    expect(tile).toContain("view rows");
    const overview = read("app/dashboard/admin/page.tsx");
    expect(overview).toContain('href="/dashboard/admin/accounts?status=active"');
    expect(overview).toContain('href="/dashboard/admin/accounts?status=trialing"');
    expect(overview).toContain('href="/dashboard/admin/accounts?status=past_due"');
    expect(overview).toContain("signupSince=7");
  });
});

describe("Phase 4 saved views + filters", () => {
  it("serialises filters and defaults columns", () => {
    expect(DEFAULT_ACCOUNT_COLUMNS).toContain("account");
    const qs = filtersToSearchParams({ status: "active", atRisk: true, sort: "health" });
    expect(qs).toContain("status=active");
    expect(qs).toContain("atRisk=1");
    expect(qs).toContain("sort=health");
  });

  it("accounts list accepts status/tag/health filters", () => {
    const src = read("lib/owner/accounts.ts");
    expect(src).toContain("opts.status");
    expect(src).toContain("ownerTags");
    expect(src).toContain("healthBand");
    expect(existsSync(join(process.cwd(), "supabase/migrations/0061_owner_console_phase4.sql"))).toBe(
      true,
    );
    expect(read("supabase/migrations/0061_owner_console_phase4.sql")).toContain("owner_saved_views");
  });
});

describe("Phase 4 bulk actions", () => {
  it("never allows bulk delete", () => {
    expect(() => assertNotBulkDelete("bulk_delete")).toThrow(/not permitted/);
    expect(() => assertNotBulkDelete("add_tag")).not.toThrow();
    const actions = read("app/dashboard/admin/phase4-actions.ts");
    expect(actions).toContain("assertNotBulkDelete");
    expect(actions).toContain("bulkOwnerAction");
    // Bulk action switch never offers a delete path
    expect(actions).not.toMatch(/action === ["']delete["']/);
    expect(actions).not.toMatch(/bulkAction.*delete/i);
  });

  it("accounts table is mobile-friendly with cards", () => {
    const table = read("components/owner/accounts-table.tsx");
    expect(table).toContain("md:hidden");
    expect(table).toContain("Bulk actions (never delete)");
  });
});

describe("Phase 4 notes, broadcast, timeline, runbooks", () => {
  it("broadcast preview substitutes name and never skips preview gate", () => {
    const p = renderBroadcastPreview({
      subject: "Hi {{name}}",
      body: "Hello {{name}}",
      sampleName: "Sam",
    });
    expect(p.subject).toBe("Hi Sam");
    expect(p.text).toBe("Hello Sam");
    expect(read("lib/owner/broadcast.ts")).toContain("outboundBlockReason");
    expect(read("lib/owner/broadcast.ts")).toContain("filterOutInternal");
    expect(read("app/dashboard/admin/broadcast/page.tsx")).toContain("previewBroadcastAction");
    expect(read("app/dashboard/admin/broadcast/page.tsx")).toContain("sendBroadcastAction");
  });

  it("notes and timeline on account detail", () => {
    const page = read("app/dashboard/admin/accounts/[id]/page.tsx");
    expect(page).toContain("addOwnerNoteAction");
    expect(page).toContain("Unified timeline");
    expect(page).toContain("Settings change history");
    expect(read("lib/owner/timeline.ts")).toContain("getAccountTimeline");
  });

  it("runbooks cover core incidents and link from alerts", () => {
    expect(RUNBOOKS.length).toBeGreaterThanOrEqual(4);
    expect(runbookForAlertRule("platform_bounce_rate")?.id).toBe("deliverability-drop");
    expect(runbookForAlertRule("cron_failure_streak")?.id).toBe("failed-cron");
    expect(read("app/dashboard/admin/alerts/page.tsx")).toContain("runbookForAlertRule");
  });

  it("settings updates write settings_updated audit", () => {
    const actions = read("app/dashboard/actions.ts");
    expect(actions).toContain("settings_updated");
    expect(actions).toContain("changes");
  });

  it("weekly digest cron is scheduled", () => {
    expect(read("vercel.json")).toContain("/api/cron/owner-weekly");
    expect(existsSync(join(process.cwd(), "app/api/cron/owner-weekly/route.ts"))).toBe(true);
    expect(read("lib/owner/digest.ts")).toContain("buildOwnerDigestBody");
  });

  it("phase4 routes are owner-gated", () => {
    for (const p of ["broadcast", "runbooks"]) {
      expect(read(`app/dashboard/admin/${p}/page.tsx`)).toContain("requireOwner");
    }
    expect(read("app/dashboard/admin/phase4-actions.ts")).toContain("assertNotViewAs");
  });
});
