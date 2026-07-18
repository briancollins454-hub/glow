import { describe, expect, it } from "vitest";
import { capableStaff, staffCanPerform, unionDayOptions } from "@/lib/booking/staff";
import type { StaffMember } from "@/lib/db/types";

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "stf_1",
    techId: "tech_1",
    authUserId: null,
    name: "Amy",
    email: "amy@example.com",
    role: "staff",
    photoPath: null,
    bio: "",
    active: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("staffCanPerform", () => {
  it("empty restriction list means they perform everything", () => {
    expect(staffCanPerform({}, "stf_1", ["svc_a", "svc_b"])).toBe(true);
    expect(staffCanPerform({ stf_1: [] }, "stf_1", ["svc_a"])).toBe(true);
  });

  it("restricted staff must cover every service in the visit", () => {
    const restrictions = { stf_1: ["svc_a", "svc_b"] };
    expect(staffCanPerform(restrictions, "stf_1", ["svc_a"])).toBe(true);
    expect(staffCanPerform(restrictions, "stf_1", ["svc_a", "svc_b"])).toBe(true);
    expect(staffCanPerform(restrictions, "stf_1", ["svc_a", "svc_c"])).toBe(false);
  });
});

describe("capableStaff", () => {
  const owner = makeStaff({ id: "stf_owner", role: "owner", name: "Bella" });
  const lashTech = makeStaff({ id: "stf_lash", name: "Amy" });
  const inactive = makeStaff({ id: "stf_gone", name: "Beth", active: false });

  it("filters to active staff who can do the whole visit", () => {
    const restrictions = { stf_lash: ["svc_lash"], stf_gone: [] };
    expect(
      capableStaff([owner, lashTech, inactive], restrictions, ["svc_lash"]).map((s) => s.id),
    ).toEqual(["stf_owner", "stf_lash"]);
    expect(
      capableStaff([owner, lashTech, inactive], restrictions, ["svc_nail"]).map((s) => s.id),
    ).toEqual(["stf_owner"]);
  });
});

describe("unionDayOptions", () => {
  it("merges days and de-duplicates overlapping slots, sorted", () => {
    const amy = [
      { dateStr: "2026-06-03", slots: ["2026-06-03T09:00:00.000Z", "2026-06-03T10:00:00.000Z"] },
    ];
    const beth = [
      { dateStr: "2026-06-03", slots: ["2026-06-03T10:00:00.000Z", "2026-06-03T11:00:00.000Z"] },
      { dateStr: "2026-06-04", slots: ["2026-06-04T09:00:00.000Z"] },
    ];
    const union = unionDayOptions([amy, beth]);
    expect(union).toEqual([
      {
        dateStr: "2026-06-03",
        slots: [
          "2026-06-03T09:00:00.000Z",
          "2026-06-03T10:00:00.000Z",
          "2026-06-03T11:00:00.000Z",
        ],
      },
      { dateStr: "2026-06-04", slots: ["2026-06-04T09:00:00.000Z"] },
    ]);
  });

  it("caps the number of days", () => {
    const many = [
      Array.from({ length: 30 }, (_, i) => ({
        dateStr: `2026-07-${String(i + 1).padStart(2, "0")}`,
        slots: ["x"],
      })),
    ];
    expect(unionDayOptions(many, 14).length).toBe(14);
  });
});
