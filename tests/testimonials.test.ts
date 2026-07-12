import { describe, expect, it } from "vitest";
import { parseCsv, testimonialColumnsOk, col, IMPORT_TESTIMONIAL_COLS } from "@/lib/csv";
import {
  TESTIMONIAL_CAP,
  defaultTestimonialShowUntil,
  isTestimonialVisible,
  parseTestimonialRating,
} from "@/lib/testimonials";

describe("testimonials helpers", () => {
  it("caps at 15", () => {
    expect(TESTIMONIAL_CAP).toBe(15);
  });

  it("defaults showUntil about 6 months ahead", () => {
    const from = new Date("2026-01-15T12:00:00.000Z");
    const until = new Date(defaultTestimonialShowUntil(from));
    expect(until.getUTCFullYear()).toBe(2026);
    expect(until.getUTCMonth()).toBe(6); // July
  });

  it("treats null showUntil as visible", () => {
    expect(isTestimonialVisible({ showUntil: null })).toBe(true);
  });

  it("hides expired testimonials", () => {
    expect(
      isTestimonialVisible(
        { showUntil: "2020-01-01T00:00:00.000Z" },
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("parses star ratings and rejects junk", () => {
    expect(parseTestimonialRating("5")).toBe(5);
    expect(parseTestimonialRating("4.2")).toBe(4);
    expect(parseTestimonialRating("")).toBeNull();
    expect(parseTestimonialRating("great")).toBeNull();
    expect(parseTestimonialRating("0")).toBeNull();
  });
});

describe("testimonial CSV import columns", () => {
  it("accepts author + review headers", () => {
    const parsed = parseCsv("Author,Rating,Review,Date\nSarah M,5,Amazing lashes,01/01/2026\n");
    expect(testimonialColumnsOk(parsed.headers)).toBe(true);
    const iAuthor = col(parsed.headers, ...IMPORT_TESTIMONIAL_COLS.author);
    const iBody = col(parsed.headers, ...IMPORT_TESTIMONIAL_COLS.body);
    expect(parsed.rows[0][iAuthor]).toBe("Sarah M");
    expect(parsed.rows[0][iBody]).toBe("Amazing lashes");
  });

  it("rejects files without a body column", () => {
    const parsed = parseCsv("Name,Stars\nEmma,5\n");
    expect(testimonialColumnsOk(parsed.headers)).toBe(false);
  });
});
