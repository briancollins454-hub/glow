import { describe, expect, it } from "vitest";
import { isAdminTech, ownerEmailCount } from "@/lib/admin";

describe("isAdminTech", () => {
  it("allows only the two owner emails", () => {
    expect(isAdminTech({ email: "brian@thesupportsdesk.com" })).toBe(true);
    expect(isAdminTech({ email: "briancollins454@mail.com" })).toBe(true);
    expect(isAdminTech({ email: " Brian@TheSupportsDesk.com " })).toBe(true);
  });

  it("denies every other email", () => {
    expect(isAdminTech({ email: "random@example.com" })).toBe(false);
    expect(isAdminTech({ email: "owner@glow-uk.com" })).toBe(false);
    expect(isAdminTech({ email: "" })).toBe(false);
  });

  it("has exactly two owners", () => {
    expect(ownerEmailCount()).toBe(2);
  });
});
