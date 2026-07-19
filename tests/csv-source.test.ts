import { describe, expect, it } from "vitest";
import {
  CSV_DIRECT_UPLOAD_MAX_BYTES,
  importCsvStoragePrefix,
  isValidImportCsvPath,
} from "@/lib/import/csv-source";

describe("csv-source path guards", () => {
  it("builds a per-tech staging prefix", () => {
    expect(importCsvStoragePrefix("tech_admin")).toBe("tmp-imports/tech_admin/");
  });

  it("accepts staged paths for the owning tech", () => {
    expect(isValidImportCsvPath("tmp-imports/tech_admin/csv_abc.csv", "tech_admin")).toBe(true);
  });

  it("rejects path traversal and other techs", () => {
    expect(isValidImportCsvPath("tmp-imports/tech_admin/../tech_x/a.csv", "tech_admin")).toBe(false);
    expect(isValidImportCsvPath("tmp-imports/tech_other/csv_abc.csv", "tech_admin")).toBe(false);
    expect(isValidImportCsvPath("tmp-imports/tech_admin/notes.txt", "tech_admin")).toBe(false);
  });

  it("keeps the direct-upload threshold under Vercel's body limit", () => {
    expect(CSV_DIRECT_UPLOAD_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});
