import { describe, expect, it } from "vitest";

/**
 * Mirrors getClientByEmail's rule: when imports leave duplicate emails,
 * the oldest row is the canonical client.
 */
function pickOldestClient<T extends { id: string; createdAt: string }>(rows: T[]): T | null {
  if (!rows.length) return null;
  return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

describe("duplicate client emails", () => {
  it("picks the oldest account when several share an email", () => {
    const rows = [
      { id: "cli_new", createdAt: "2026-07-20T12:00:00.000Z" },
      { id: "cli_old", createdAt: "2024-01-01T10:00:00.000Z" },
      { id: "cli_mid", createdAt: "2025-06-01T10:00:00.000Z" },
    ];
    expect(pickOldestClient(rows)?.id).toBe("cli_old");
  });

  it("returns null for an empty list", () => {
    expect(pickOldestClient([])).toBeNull();
  });
});
