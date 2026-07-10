import { describe, expect, it } from "vitest";
import { bookUrl, buildDmQuoteCopy, quoteUrl } from "@/lib/dm-quote";
import { makeService, makeTech } from "./fixtures";

describe("quoteUrl", () => {
  it("builds public quote page URL", () => {
    expect(quoteUrl("abc123", "https://glow-uk.com")).toBe("https://glow-uk.com/q/abc123");
  });
});

describe("bookUrl", () => {
  it("pre-selects service and passes quote token", () => {
    const url = bookUrl("bella", "svc_1", "tok_q", "https://glow-uk.com");
    expect(url).toContain("/bella?");
    expect(url).toContain("service=svc_1");
    expect(url).toContain("quote=tok_q");
  });
});

describe("buildDmQuoteCopy", () => {
  it("includes service, price, deposit and link", () => {
    const copy = buildDmQuoteCopy(
      makeTech({ businessName: "Bella Rose" }),
      {
        clientName: "Sophie Turner",
        pricePennies: 5500,
        depositPennies: 1650,
        note: "Can't wait!",
      },
      makeService({ name: "Classic Full Set", durationMin: 120 }),
      [{ name: "Wispy", pricePennies: 500 }],
      "https://glow-uk.com/q/tok",
    );
    expect(copy.instagram).toContain("Hi Sophie!");
    expect(copy.instagram).toContain("Classic Full Set");
    expect(copy.instagram).toContain("£55.00");
    expect(copy.instagram).toContain("£16.50 deposit");
    expect(copy.instagram).toContain("Can't wait!");
    expect(copy.instagram).toContain("https://glow-uk.com/q/tok");
  });
});
