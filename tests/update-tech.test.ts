import { describe, expect, it } from "vitest";
import { patchWithoutMissingColumn } from "@/lib/db/queries";

describe("patchWithoutMissingColumn", () => {
  it("removes a missing column from the patch", () => {
    expect(patchWithoutMissingColumn({ name: "Claudia", infillNudgesEnabled: true }, "infillNudgesEnabled")).toEqual({
      name: "Claudia",
    });
  });

  it("returns null when the column is not in the patch", () => {
    expect(patchWithoutMissingColumn({ name: "Claudia" }, "infillNudgesEnabled")).toBeNull();
  });
});
