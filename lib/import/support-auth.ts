import { isAdminTech } from "@/lib/admin";
import type { Tech } from "@/lib/db/types";

/** Same gate as other Owner admin pages: owner role + ADMIN_EMAILS. */
export function canAccessSupportImport(
  tech: Pick<Tech, "email"> | null | undefined,
  role: "owner" | "staff" | null | undefined = "owner",
): boolean {
  if (!tech || role !== "owner") return false;
  return isAdminTech(tech);
}

export type SupportImportAuditMeta = {
  adminTechId: string;
  targetTechId: string;
  fileName: string;
  imported: number;
  skipped: number;
  rows?: number;
  excludedCalendars?: number;
  source?: string;
};

export function buildSupportImportAuditMeta(
  input: SupportImportAuditMeta,
): SupportImportAuditMeta {
  return { ...input };
}
