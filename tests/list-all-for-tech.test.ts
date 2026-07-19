import { describe, expect, it, vi } from "vitest";

describe("listClients / listBookings pagination", () => {
  it("pages past the Supabase 1000-row default", async () => {
    vi.resetModules();
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `cli_${i}`, name: `A${i}` }));
    const page2 = Array.from({ length: 3 }, (_, i) => ({ id: `cli_${1000 + i}`, name: `B${i}` }));
    let calls = 0;
    const range = vi.fn((_from: number, _to: number) => {
      calls++;
      const data = calls === 1 ? page1 : page2;
      return Promise.resolve({ data, error: null });
    });
    const order = vi.fn(() => ({ range }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const sb = { from } as never;

    const { listClients } = await import("@/lib/db/queries");
    const clients = await listClients(sb, "tech_x");
    expect(clients).toHaveLength(1003);
    expect(calls).toBe(2);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});
