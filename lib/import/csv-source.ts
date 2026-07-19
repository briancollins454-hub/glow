/** Files larger than this leave Vercel via a signed Storage upload instead of the Server Action body. */
export const CSV_DIRECT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

const IMPORT_PATH_PREFIX = "tmp-imports/";

export function importCsvStoragePrefix(ownerTechId: string): string {
  return `${IMPORT_PATH_PREFIX}${ownerTechId}/`;
}

export function isValidImportCsvPath(path: string, ownerTechId: string): boolean {
  const prefix = importCsvStoragePrefix(ownerTechId);
  return (
    path.startsWith(prefix) &&
    !path.includes("..") &&
    path.endsWith(".csv") &&
    path.length < 240
  );
}

/**
 * Read CSV text from a multipart File, or from a staged Storage path
 * (`csvStoragePath` + optional `csvFileName`) after a large-file upload.
 */
export async function readCsvFromFormData(
  formData: FormData,
  ownerTechId: string,
): Promise<{ text: string; fileName: string } | null> {
  const storagePath = String(formData.get("csvStoragePath") ?? "").trim();
  if (storagePath) {
    if (!isValidImportCsvPath(storagePath, ownerTechId)) {
      throw new Error("Invalid import storage path");
    }
    const { downloadStorageText, removePhoto } = await import("@/lib/storage");
    try {
      const text = await downloadStorageText(storagePath);
      const fileName = String(formData.get("csvFileName") ?? "upload.csv").trim() || "upload.csv";
      return { text, fileName };
    } finally {
      try {
        await removePhoto(storagePath);
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  const file = formData.get("csv");
  if (!file || typeof file !== "object" || !("text" in file)) return null;
  const f = file as File;
  if (!f.size) return null;
  return {
    text: await f.text(),
    fileName: String(f.name || "upload.csv"),
  };
}
