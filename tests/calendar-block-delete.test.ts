import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { timeOffInColumn } from "@/lib/booking/staff-day";
import { deleteTimeOffForTech } from "@/lib/db/queries";
import type { TimeOff } from "@/lib/db/types";

function off(partial: Partial<TimeOff> & Pick<TimeOff, "id" | "startIso" | "endIso">): TimeOff {
  return {
    techId: "tech_1",
    reason: "",
    staffId: null,
    ...partial,
  };
}

function timeOffSb(opts: {
  row: TimeOff | null;
  onDelete?: (id: string) => void;
}) {
  return {
    from: (table: string) => {
      expect(table).toBe("time_off");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.row, error: null }),
          }),
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            opts.onDelete?.(id);
            return { error: null };
          },
        }),
      };
    },
  };
}

describe("calendar manual block vs rota unavailable", () => {
  it("day view uses distinct components for manual blocks and rota shading", () => {
    const view = readFileSync(
      join(process.cwd(), "components/dashboard/bookings-staff-day-view.tsx"),
      "utf8",
    );
    const blockUi = readFileSync(
      join(process.cwd(), "components/dashboard/calendar-time-block.tsx"),
      "utf8",
    );
    expect(view).toContain("CalendarManualBlock");
    expect(view).toContain("CalendarRotaUnavailable");
    expect(blockUi).toContain("Delete block");
    expect(blockUi).toContain("Are you sure you want to delete this block?");
    expect(blockUi).toContain("deleteTimeOffAction");
    const rotaFn = blockUi.slice(blockUi.indexOf("CalendarRotaUnavailable"));
    expect(rotaFn).toContain("Outside working hours");
    expect(rotaFn).not.toContain("Delete block");
    expect(rotaFn).not.toContain("deleteTimeOffAction");
  });

  it("manual blocks use calendar-manual-block token class", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain(".calendar-manual-block");
    expect(css).toContain("--calendar-block-edge");
  });
});

describe("multi-staff time-off rows are independent", () => {
  it("deleting one staff column block leaves the other staff member's block", () => {
    const dayOffs = [
      off({
        id: "off_a",
        staffId: "stf_a",
        startIso: "2026-03-10T12:00:00.000Z",
        endIso: "2026-03-10T13:00:00.000Z",
        reason: "Lunch",
      }),
      off({
        id: "off_b",
        staffId: "stf_b",
        startIso: "2026-03-10T12:00:00.000Z",
        endIso: "2026-03-10T13:00:00.000Z",
        reason: "Lunch",
      }),
    ];
    const remaining = dayOffs.filter((o) => o.id !== "off_a");
    expect(timeOffInColumn(remaining, "stf_a")).toEqual([]);
    expect(timeOffInColumn(remaining, "stf_b").map((o) => o.id)).toEqual(["off_b"]);
  });
});

describe("deleteTimeOffForTech tenancy", () => {
  it("deletes only when techId matches and returns the deleted row", async () => {
    const row = off({
      id: "off_1",
      techId: "tech_1",
      startIso: "2026-03-10T12:00:00.000Z",
      endIso: "2026-03-10T13:00:00.000Z",
    });
    const deleted: string[] = [];
    const result = await deleteTimeOffForTech(
      timeOffSb({ row, onDelete: (id) => deleted.push(id) }) as never,
      "off_1",
      "tech_1",
    );
    expect(result).toEqual({ ok: true, deleted: row });
    expect(deleted).toEqual(["off_1"]);
  });

  it("refuses another account's block", async () => {
    const row = off({
      id: "off_x",
      techId: "tech_other",
      startIso: "2026-03-10T12:00:00.000Z",
      endIso: "2026-03-10T13:00:00.000Z",
    });
    const deleted: string[] = [];
    const result = await deleteTimeOffForTech(
      timeOffSb({ row, onDelete: (id) => deleted.push(id) }) as never,
      "off_x",
      "tech_1",
    );
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(deleted).toEqual([]);
  });

  it("returns not_found when the row is missing", async () => {
    const deleted: string[] = [];
    const result = await deleteTimeOffForTech(
      timeOffSb({ row: null, onDelete: (id) => deleted.push(id) }) as never,
      "missing",
      "tech_1",
    );
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(deleted).toEqual([]);
  });
});

describe("deleteTimeOffAction audits and scopes", () => {
  it("uses deleteTimeOffForTech and audits time_off_deleted", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/actions.ts"), "utf8");
    expect(src).toContain("deleteTimeOffForTech");
    expect(src).toMatch(/time_off_deleted/);
    expect(src).toMatch(/deleteTimeOffAction[\s\S]*tech\.id/);
  });
});
