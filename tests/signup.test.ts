import { describe, expect, it } from "vitest";
import { postSignupPath } from "@/lib/signup";

describe("postSignupPath", () => {
  it("sends unpaid accounts to billing welcome", () => {
    expect(postSignupPath({ subscriptionStatus: "none" })).toBe("/dashboard/billing?welcome=1");
    expect(postSignupPath({ subscriptionStatus: "canceled" })).toBe("/dashboard/billing?welcome=1");
  });

  it("sends live accounts to the dashboard", () => {
    expect(postSignupPath({ subscriptionStatus: "active" })).toBe("/dashboard");
    expect(postSignupPath({ subscriptionStatus: "comped" })).toBe("/dashboard");
    expect(postSignupPath({ subscriptionStatus: "trialing" })).toBe("/dashboard");
  });
});
