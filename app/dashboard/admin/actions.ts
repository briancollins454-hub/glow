"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/auth/session";
import { isAdminTech } from "@/lib/admin";
import { canAccessSupportImport, buildSupportImportAuditMeta } from "@/lib/import/support-auth";
import { importResultUrl } from "@/lib/import/import-url";
import {
  importBookingsForTech,
  importClientsForTech,
  importServicesForTech,
} from "@/lib/import/csv-import";
import { supabaseService } from "@/lib/supabase/service";
import { createAuditEvent, getTechById, updateTech } from "@/lib/db/queries";
import type { Tech } from "@/lib/db/types";

async function adminCtx() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!isAdminTech(c!.tech)) notFound();
  return c!;
}

async function adminAudit(adminTechId: string, action: string, targetTechId: string) {
  try {
    await createAuditEvent(supabaseService(), {
      techId: adminTechId,
      actor: "tech",
      action,
      entityType: "tech",
      entityId: targetTechId,
      metadata: {},
    });
  } catch {
    // Audit is best-effort.
  }
}

/** redirect() works by throwing; imports must rethrow it, not treat it as a failure. */
function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function supportImportCtx(formData: FormData): Promise<{
  admin: Tech;
  target: Tech;
  returnTo: string;
}> {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  if (!canAccessSupportImport(c.tech, c.role)) notFound();

  const techId = String(formData.get("techId") ?? "").trim();
  if (!techId) notFound();

  const target = await getTechById(supabaseService(), techId);
  if (!target) notFound();

  const returnTo = `/dashboard/admin/support-import?tech=${encodeURIComponent(target.id)}`;
  return { admin: c.tech, target, returnTo };
}

async function runSupportImport(
  formData: FormData,
  where: string,
  work: (ctx: { admin: Tech; target: Tech; returnTo: string }) => Promise<void>,
): Promise<void> {
  let returnTo = "/dashboard/admin/support-import";
  try {
    const scoped = await supportImportCtx(formData);
    returnTo = scoped.returnTo;
    await work(scoped);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const { reportError } = await import("@/lib/monitor");
    await reportError(e, { where });
    redirect(importResultUrl(returnTo, { import: "failed" }));
  }
}

function supportAuditWriter(admin: Tech, target: Tech) {
  return async (info: {
    action: string;
    fileName: string;
    imported: number;
    skipped: number;
    rows: number;
    excludedCalendars?: number;
    source?: string;
  }) => {
    try {
      await createAuditEvent(supabaseService(), {
        techId: admin.id,
        actor: "tech",
        action: info.action,
        entityType: "import",
        entityId: target.id,
        metadata: buildSupportImportAuditMeta({
          adminTechId: admin.id,
          targetTechId: target.id,
          fileName: info.fileName,
          imported: info.imported,
          skipped: info.skipped,
          rows: info.rows,
          excludedCalendars: info.excludedCalendars,
          source: info.source,
        }),
      });
    } catch {
      // Audit is best-effort.
    }
  };
}

export async function supportImportClientsAction(formData: FormData) {
  return runSupportImport(formData, "supportImportClientsAction", async ({ admin, target, returnTo }) => {
    await importClientsForTech(formData, {
      sb: supabaseService(),
      tech: target,
      returnTo,
      importActorTechId: admin.id,
      auditExtra: { via: "support_import", adminTechId: admin.id },
      onSupportAudit: supportAuditWriter(admin, target),
    });
  });
}

export async function supportImportServicesAction(formData: FormData) {
  return runSupportImport(formData, "supportImportServicesAction", async ({ admin, target, returnTo }) => {
    await importServicesForTech(formData, {
      sb: supabaseService(),
      tech: target,
      returnTo,
      importActorTechId: admin.id,
      auditExtra: { via: "support_import", adminTechId: admin.id },
      onSupportAudit: supportAuditWriter(admin, target),
    });
  });
}

export async function supportImportBookingsAction(formData: FormData) {
  return runSupportImport(formData, "supportImportBookingsAction", async ({ admin, target, returnTo }) => {
    await importBookingsForTech(formData, {
      sb: supabaseService(),
      tech: target,
      returnTo,
      importActorTechId: admin.id,
      auditExtra: { via: "support_import", adminTechId: admin.id },
      onSupportAudit: supportAuditWriter(admin, target),
    });
  });
}

export type ClientNameCleanupRow = {
  clientId: string;
  currentName: string;
  currentPhone: string;
  issue: "digits" | "blank";
  proposedName: string;
  proposedPhone: string;
  movedDigitsToPhone: boolean;
};

/**
 * Preview malformed imported client names for one account: phone-number
 * runs (6+ digits) in the name, or fully blank names. Read-only; nothing is
 * written until applyClientNameCleanupAction confirms specific clients.
 */
export async function previewClientNameCleanupAction(
  techId: string,
): Promise<{ ok: true; rows: ClientNameCleanupRow[] } | { ok: false; error: string }> {
  await adminCtx();
  const id = techId.trim();
  if (!id) return { ok: false, error: "Choose an account first." };

  const sb = supabaseService();
  const target = await getTechById(sb, id);
  if (!target) return { ok: false, error: "Account not found." };

  const { findMalformedClients } = await import("@/lib/import/name-cleanup");
  const { listClients } = await import("@/lib/db/queries");
  const clients = await listClients(sb, target.id);

  const rows = findMalformedClients(clients).map(({ client, proposal }) => ({
    clientId: client.id,
    currentName: client.name,
    currentPhone: client.phone,
    issue: proposal.issue,
    proposedName: proposal.name,
    proposedPhone: proposal.phone,
    movedDigitsToPhone: proposal.movedDigitsToPhone,
  }));
  return { ok: true, rows };
}

/**
 * Apply the digits-in-name fixes previewed above for the ticked clients.
 * Blank-name clients are never written here (they need manual naming).
 * Strictly scoped: every client must belong to the given tech account.
 */
export async function applyClientNameCleanupAction(
  techId: string,
  clientIds: string[],
): Promise<{ ok: true; fixed: number; skipped: number } | { ok: false; error: string }> {
  const { tech: admin } = await adminCtx();
  const id = techId.trim();
  if (!id) return { ok: false, error: "Choose an account first." };
  if (clientIds.length === 0) return { ok: false, error: "Tick at least one client to fix." };

  const sb = supabaseService();
  const target = await getTechById(sb, id);
  if (!target) return { ok: false, error: "Account not found." };

  const { proposeNameFix } = await import("@/lib/import/name-cleanup");
  const { getClient, updateClient } = await import("@/lib/db/queries");

  let fixed = 0;
  let skipped = 0;
  for (const clientId of clientIds) {
    const client = await getClient(sb, clientId);
    // Scope guard: never touch a client on another account.
    if (!client || client.techId !== target.id) {
      skipped++;
      continue;
    }
    const proposal = proposeNameFix(client);
    if (!proposal || proposal.issue !== "digits" || !proposal.name) {
      skipped++;
      continue;
    }
    await updateClient(sb, client.id, { name: proposal.name, phone: proposal.phone });
    fixed++;
  }

  await adminAudit(admin.id, "admin_client_name_cleanup", target.id);
  return { ok: true, fixed, skipped };
}

/** Toggle the £1 tester offer on an account (fixes pre-fix signups too). */
export async function setTesterOfferAction(formData: FormData) {
  const { tech: admin } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  const makeTester = formData.get("tester") === "1";
  await updateTech(supabaseService(), id, { signupOffer: makeTester ? "tester" : "" });
  await adminAudit(admin.id, makeTester ? "admin_marked_tester" : "admin_unmarked_tester", id);
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}

/** Give (or remove) complimentary access - e.g. friends & family accounts. */
export async function setCompAction(formData: FormData) {
  const { tech: admin } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  const comp = formData.get("comp") === "1";
  await updateTech(supabaseService(), id, {
    subscriptionStatus: comp ? "comped" : "none",
  });
  await adminAudit(admin.id, comp ? "admin_comped_account" : "admin_uncomped_account", id);
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}
