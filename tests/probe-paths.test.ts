import { describe, expect, it } from "vitest";
import { isProbePath } from "@/lib/probe-paths";
import { isValidPublicHandle, slugify } from "@/lib/utils";

describe("isValidPublicHandle", () => {
  it("accepts slugified handles", () => {
    expect(isValidPublicHandle("frame-and-define")).toBe(true);
    expect(isValidPublicHandle("ilashit")).toBe(true);
    expect(isValidPublicHandle("a")).toBe(true);
  });

  it("rejects scanner paths and invalid slugs", () => {
    expect(isValidPublicHandle("wp-config.php")).toBe(false);
    expect(isValidPublicHandle(".env")).toBe(false);
    expect(isValidPublicHandle("-bad")).toBe(false);
    expect(isValidPublicHandle("")).toBe(false);
  });

  it("matches slugify output", () => {
    const handle = slugify("Frame & Define");
    expect(isValidPublicHandle(handle)).toBe(true);
  });
});

describe("isProbePath", () => {
  it("flags common WordPress scanner paths", () => {
    expect(isProbePath("/wp-config.php")).toBe(true);
    expect(isProbePath("/wp-admin")).toBe(true);
    expect(isProbePath("/xmlrpc")).toBe(true);
  });

  it("allows real booking pages", () => {
    expect(isProbePath("/frame-and-define")).toBe(false);
    expect(isProbePath("/ilashit")).toBe(false);
    expect(isProbePath("/")).toBe(false);
  });
});
