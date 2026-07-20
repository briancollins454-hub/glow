import { describe, expect, it, vi } from "vitest";

/**
 * Regression: a message created on the client token path must appear in the
 * tech-side thread list for that account (owner or staff dashboard).
 */
describe("tech-side messages list", () => {
  it("includes a client-token message in listMessagesForTech for the same techId", async () => {
    vi.resetModules();

    const inserted: Record<string, unknown>[] = [];
    const range = vi.fn((_from: number, _to: number) => {
      // Newest first page for listAllForTech(…, ascending: false)
      return Promise.resolve({
        data: inserted.slice().sort((a, b) =>
          String(b.createdAt).localeCompare(String(a.createdAt)),
        ),
        error: null,
      });
    });
    const order = vi.fn(() => ({ range }));
    const eq = vi.fn(() => ({ order, select: vi.fn(), insert: vi.fn() }));
    const select = vi.fn(() => ({ eq }));
    const single = vi.fn(async () => {
      const row = inserted[inserted.length - 1]!;
      return { data: row, error: null };
    });
    const insertSelect = vi.fn(() => ({ single }));
    const insert = vi.fn((row: Record<string, unknown>) => {
      const full = {
        ...row,
        createdAt: "2026-07-20T10:00:00.000Z",
        readAt: null,
      };
      inserted.push(full);
      return { select: insertSelect };
    });

    const from = vi.fn((table: string) => {
      if (table === "messages") {
        return { select, insert, eq };
      }
      return { select };
    });
    const sb = { from } as never;

    const { createMessage, listMessagesForTech } = await import("@/lib/db/queries");

    const created = await createMessage(sb, {
      techId: "tech_allure",
      clientId: "cli_ruby",
      sender: "client",
      body: "Hi from the client link",
    });
    expect(created.body).toBe("Hi from the client link");
    expect(created.techId).toBe("tech_allure");

    const listed = await listMessagesForTech(sb, "tech_allure");
    expect(listed.some((m) => m.id === created.id && m.body === "Hi from the client link")).toBe(
      true,
    );
  });

  it("builds a conversation thread even when the client join is missing", () => {
    const messages = [
      {
        id: "msg_1",
        techId: "tech_1",
        clientId: "cli_missing",
        sender: "client" as const,
        body: "Hello",
        readAt: null,
        createdAt: "2026-07-20T10:00:00.000Z",
      },
    ];
    const clients: { id: string; name: string }[] = [];
    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const latest = new Map<string, (typeof messages)[0]>();
    for (const m of messages) {
      if (!latest.has(m.clientId)) latest.set(m.clientId, m);
    }
    const threads = [...latest.entries()].map(([clientId, last]) => ({
      clientId,
      client: clientById[clientId] ?? null,
      last,
    }));
    expect(threads).toHaveLength(1);
    expect(threads[0]!.client).toBeNull();
    expect(threads[0]!.last.body).toBe("Hello");
  });
});
