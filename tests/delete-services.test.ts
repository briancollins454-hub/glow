import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({}),
}));

describe("deleteServices", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("clears dependents then deletes services in chunks", async () => {
    const calls: { table: string; op: string; ids?: string[] }[] = [];

    const makeBuilder = (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.update = () => {
        calls.push({ table, op: "update" });
        return builder;
      };
      builder.delete = () => {
        calls.push({ table, op: "delete" });
        return builder;
      };
      builder.eq = chain;
      builder.in = (_col: string, ids: string[]) => {
        calls.push({ table, op: "in", ids });
        return Promise.resolve({ error: null });
      };
      return builder;
    };

    const sb = {
      from: (table: string) => {
        fromMock(table);
        return makeBuilder(table);
      },
    };

    const { deleteServices } = await import("@/lib/db/queries");
    const ids = Array.from({ length: 3 }, (_, i) => `svc_${i}`);
    const n = await deleteServices(sb as never, ids);
    expect(n).toBe(3);

    const tables = calls.map((c) => c.table);
    expect(tables).toContain("services");
    expect(tables).toContain("bookings");
    expect(tables).toContain("waitlist_entries");
    // Bookings deleted before final services delete
    const bookingIn = calls.findIndex((c) => c.table === "bookings" && c.op === "in");
    const serviceDeletes = calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.table === "services" && c.op === "in");
    expect(bookingIn).toBeGreaterThanOrEqual(0);
    expect(serviceDeletes.at(-1)!.i).toBeGreaterThan(bookingIn);
  });

  it("returns 0 for an empty list", async () => {
    const { deleteServices } = await import("@/lib/db/queries");
    const n = await deleteServices({ from: fromMock } as never, []);
    expect(n).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
