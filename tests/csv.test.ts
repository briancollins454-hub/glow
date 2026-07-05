import { describe, expect, it } from "vitest";
import { col, moneyToPennies, parseCsv, parseCsvLine, toMinutes } from "@/lib/csv";

describe("parseCsvLine", () => {
  it("splits simple lines", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCsvLine('"Smith, Jane",jane@example.com')).toEqual(["Smith, Jane", "jane@example.com"]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvLine('"She said ""hi""",x')).toEqual(['She said "hi"', "x"]);
  });
});

describe("parseCsv", () => {
  it("normalises headers to lowercase letters", () => {
    const { headers, rows } = parseCsv("First Name,E-mail Address\nJane,j@x.com");
    expect(headers).toEqual(["firstname", "emailaddress"]);
    expect(rows).toEqual([["Jane", "j@x.com"]]);
  });
  it("skips blank lines", () => {
    const { rows } = parseCsv("name\n\nJane\n\n");
    expect(rows).toEqual([["Jane"]]);
  });
});

describe("col", () => {
  it("finds the first matching header", () => {
    expect(col(["clientname", "email"], "name", "clientname")).toBe(0);
    expect(col(["a", "b"], "missing")).toBe(-1);
  });
});

describe("moneyToPennies", () => {
  it("parses currency strings", () => {
    expect(moneyToPennies("£45.00")).toBe(4500);
    expect(moneyToPennies("45.5")).toBe(4550);
    expect(moneyToPennies("not money")).toBe(0);
  });
});

describe("toMinutes", () => {
  it("parses common duration formats", () => {
    expect(toMinutes("90")).toBe(90);
    expect(toMinutes("1h 30m")).toBe(90);
    expect(toMinutes("1:30")).toBe(90);
    expect(toMinutes("90 min")).toBe(90);
    expect(toMinutes("")).toBe(0);
  });
});
