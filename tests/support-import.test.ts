import { describe, expect, it, vi, beforeEach } from "vitest";
import { canAccessSupportImport, buildSupportImportAuditMeta } from "@/lib/import/support-auth";
import { importResultUrl } from "@/lib/import/import-url";
import { makeTech } from "./fixtures";

describe("canAccessSupportImport", () => {
  it("allows the owner admin email", () => {
    expect(
      canAccessSupportImport(makeTech({ email: "brian@thesupportsdesk.com" }), "owner"),
    ).toBe(true);
  });

  it("rejects a non-admin owner", () => {
    expect(canAccessSupportImport(makeTech({ email: "claire@example.com" }), "owner")).toBe(
      false,
    );
  });

  it("rejects staff even with an admin email", () => {
    expect(
      canAccessSupportImport(makeTech({ email: "brian@thesupportsdesk.com" }), "staff"),
    ).toBe(false);
  });

  it("rejects missing tech", () => {
    expect(canAccessSupportImport(null, "owner")).toBe(false);
  });
});

describe("importResultUrl", () => {
  it("preserves the selected tech query when adding import status", () => {
    expect(
      importResultUrl("/dashboard/admin/support-import?tech=tech_abc", {
        import: "done",
        what: "clients",
        n: 12,
        s: 1,
      }),
    ).toBe(
      "/dashboard/admin/support-import?tech=tech_abc&import=done&what=clients&n=12&s=1",
    );
  });

  it("works for the ordinary Move to Glow path", () => {
    expect(importResultUrl("/dashboard/import", { import: "empty" })).toBe(
      "/dashboard/import?import=empty",
    );
  });
});

describe("buildSupportImportAuditMeta", () => {
  it("records admin id, target tech id, file name and counts", () => {
    expect(
      buildSupportImportAuditMeta({
        adminTechId: "tech_admin",
        targetTechId: "tech_w3qj31-PpnIM",
        fileName: "appointments.csv",
        imported: 40,
        skipped: 2,
        rows: 42,
      }),
    ).toEqual({
      adminTechId: "tech_admin",
      targetTechId: "tech_w3qj31-PpnIM",
      fileName: "appointments.csv",
      imported: 40,
      skipped: 2,
      rows: 42,
    });
  });
});

describe("admin-support-import page loader gate", () => {
  it("returns forbidden for non-admin accounts", async () => {
    const { loadDashboardPageData } = await import("@/lib/dashboard/page-loaders");
    const result = await loadDashboardPageData("admin-support-import", {
      sb: {} as never,
      tech: makeTech({ email: "not-admin@example.com" }),
      role: "owner",
    });
    expect(result).toEqual({ forbidden: true });
  });

  it("returns forbidden for staff role", async () => {
    const { loadDashboardPageData } = await import("@/lib/dashboard/page-loaders");
    const result = await loadDashboardPageData("admin-support-import", {
      sb: {} as never,
      tech: makeTech({ email: "brian@thesupportsdesk.com" }),
      role: "staff",
    });
    expect(result).toEqual({ forbidden: true });
  });
});

describe("importClientsForTech scopes writes to the selected tech", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates clients under the target tech id and records a support audit", async () => {
    const createClient = vi.fn(async (_sb: unknown, row: { techId: string; name: string }) => ({
      ...row,
      id: "cli_1",
      email: (row as { email?: string }).email ?? "",
      phone: (row as { phone?: string }).phone ?? "",
    }));
    const listClients = vi.fn(async () => []);
    const createAuditEvent = vi.fn(async () => undefined);
    const redirect = vi.fn((url: string) => {
      const err = new Error("NEXT_REDIRECT");
      (err as { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
      throw err;
    });

    vi.doMock("@/lib/db/queries", async () => {
      const actual = await vi.importActual<typeof import("@/lib/db/queries")>("@/lib/db/queries");
      return {
        ...actual,
        createClient,
        listClients,
        createAuditEvent,
      };
    });
    vi.doMock("next/navigation", () => ({ redirect }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));

    const { importClientsForTech } = await import("@/lib/import/csv-import");
    const target = makeTech({ id: "tech_target", email: "allure@example.com" });
    const formData = new FormData();
    formData.set(
      "csv",
      new File(
        ["Name,Email,Phone\nJane Smith,jane@example.com,+447700900123\n"],
        "clients.csv",
        { type: "text/csv" },
      ),
    );

    const supportAudits: unknown[] = [];
    try {
      await importClientsForTech(formData, {
        sb: {} as never,
        tech: target,
        returnTo: "/dashboard/admin/support-import?tech=tech_target",
        auditExtra: { via: "support_import", adminTechId: "tech_admin" },
        onSupportAudit: async (info) => {
          supportAudits.push(info);
        },
      });
    } catch (e) {
      expect(String((e as { digest?: string }).digest)).toContain("import=done");
    }

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][1].techId).toBe("tech_target");
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        techId: "tech_target",
        action: "clients_imported",
        metadata: expect.objectContaining({
          via: "support_import",
          adminTechId: "tech_admin",
          imported: 1,
        }),
      }),
    );
    expect(supportAudits).toEqual([
      expect.objectContaining({
        action: "support_clients_imported",
        fileName: "clients.csv",
        imported: 1,
        skipped: 0,
      }),
    ]);
  });
});
