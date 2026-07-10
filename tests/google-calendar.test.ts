import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/format";

/** Mirrors googleDateTime in lib/google-calendar.ts */
function googleDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

describe("googleDateTime", () => {
  it("formats a London summer time as local wall-clock without Z", () => {
    // 2026-07-19 10:00 BST = 09:00 UTC
    const iso = "2026-07-19T09:00:00.000Z";
    expect(googleDateTime(iso)).toBe("2026-07-19T10:00:00");
  });
});
