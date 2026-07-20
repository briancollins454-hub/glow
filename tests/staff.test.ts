import { describe, expect, it } from "vitest";
import { capableStaff, staffCanPerform, unionDayOptions, workingHoursForStaff } from "@/lib/booking/staff";
import type { StaffMember } from "@/lib/db/types";
import { daySlots } from "@/lib/rules";
import { makeService, makeWorkingHour } from "./fixtures";

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

describe("workingHoursForStaff", () => {
  const owner = makeStaff({ id: "stf_owner", role: "owner", name: "Bella" });
  const amy = makeStaff({ id: "stf_amy", name: "Amy" });
  const ownerHours = makeWorkingHour({
    id: "wh_owner",
    staffId: "stf_owner",
    weekday: 3,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  });
  const amyHours = makeWorkingHour({
    id: "wh_amy",
    staffId: "stf_amy",
    weekday: 3,
    startMinutes: 10 * 60,
    endMinutes: 16 * 60,
  });

  it("returns a staff member's own hours when set", () => {
    expect(workingHoursForStaff([ownerHours, amyHours], amy, owner.id)).toEqual([amyHours]);
  });

  it("falls back to owner hours when the staff member has none", () => {
    expect(workingHoursForStaff([ownerHours], amy, owner.id)).toEqual([ownerHours]);
  });

  it("treats legacy null staffId rows as owner hours for fallback", () => {
    const legacy = makeWorkingHour({ id: "wh_legacy", staffId: null });
    expect(workingHoursForStaff([legacy], amy, owner.id)).toEqual([legacy]);
  });
});

describe("slots respect staff working hours", () => {
  // 2030-07-10 is a Wednesday (weekday 3). July = BST.
  const dateStr = "2030-07-10";
  const now = new Date("2030-07-01T00:00:00.000Z").getTime();
  const service = makeService({ durationMin: 60 });
  const owner = makeStaff({ id: "stf_owner", role: "owner" });
  const amy = makeStaff({ id: "stf_amy" });

  it("does not offer slots outside the staff member's hours", () => {
    const hours = [
      makeWorkingHour({
        staffId: amy.id,
        weekday: 3,
        startMinutes: 10 * 60,
        endMinutes: 14 * 60,
      }),
    ];
    const slots = daySlots(
      service,
      dateStr,
      { workingHours: workingHoursForStaff(hours, amy, owner.id), timeOff: [], bookings: [] },
      now,
    );
    // 10:00 London = 09:00 UTC; last start for 60-min ending by 14:00 is 13:00 London.
    expect(slots[0]).toBe("2030-07-10T09:00:00.000Z");
    expect(slots).not.toContain("2030-07-10T08:00:00.000Z"); // 09:00 London - before open
    expect(slots).not.toContain("2030-07-10T13:00:00.000Z"); // 14:00 London - would end after close
  });

  it("uses owner hours for slot bounds when staff has no rows", () => {
    const ownerHours = [
      makeWorkingHour({
        staffId: owner.id,
        weekday: 3,
        startMinutes: 11 * 60,
        endMinutes: 15 * 60,
      }),
    ];
    const slots = daySlots(
      service,
      dateStr,
      {
        workingHours: workingHoursForStaff(ownerHours, amy, owner.id),
        timeOff: [],
        bookings: [],
      },
      now,
    );
    expect(slots[0]).toBe("2030-07-10T10:00:00.000Z"); // 11:00 London
    expect(slots).not.toContain("2030-07-10T08:00:00.000Z");
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
