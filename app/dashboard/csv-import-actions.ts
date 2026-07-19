"use server";

import { getDashboardContext } from "@/lib/auth/session";
import { randomId } from "@/lib/ids";

/**
 * Stage a large CSV in Storage so the import Server Action only receives a path
 * (Vercel rejects multipart bodies over ~4.5MB before our action try/catch runs).
 */
export async function prepareCsvImportUploadAction(): Promise<
  { ok: true; path: string; token: string; signedUrl: string } | { ok: false; error: string }
> {
  const c = await getDashboardContext();
  if (!c) return { ok: false, error: "unauthorized" };
  try {
    const { createCsvImportUploadUrl } = await import("@/lib/storage");
    const { importCsvStoragePrefix } = await import("@/lib/import/csv-source");
    const path = `${importCsvStoragePrefix(c.tech.id)}${randomId("csv")}.csv`;
    const upload = await createCsvImportUploadUrl(path);
    return { ok: true, ...upload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "upload_url_failed" };
  }
}
