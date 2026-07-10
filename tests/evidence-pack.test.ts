import { describe, expect, it } from "vitest";
import { evidencePackFilename } from "@/lib/evidence-pack";
import { makeClient } from "./fixtures";

describe("evidencePackFilename", () => {
  it("sanitises client name and includes date", () => {
    const name = evidencePackFilename(
      makeClient({ name: "Sophie Turner" }),
      new Date("2026-07-10T12:00:00.000Z"),
    );
    expect(name).toBe("evidence-pack-Sophie-Turner-2026-07-10.pdf");
  });

  it("handles special characters in names", () => {
    const name = evidencePackFilename(
      makeClient({ name: "Mary O'Brien (VIP)" }),
      new Date("2026-07-10T12:00:00.000Z"),
    );
    expect(name).toMatch(/^evidence-pack-Mary-O-Brien-VIP-2026-07-10\.pdf$/);
  });
});
