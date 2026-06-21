import { describe, expect, it } from "vitest";
import { minutesToLabel, slugify, yearOf } from "@/lib/utils";
import { isValidRating } from "@/lib/ratings";

describe("display utilities", () => {
  it("formats runtime and dates", () => {
    expect(minutesToLabel(142)).toBe("2h 22m");
    expect(minutesToLabel(null)).toBe("Runtime TBA");
    expect(yearOf("2026-06-19")).toBe("2026");
  });
  it("creates stable list slugs", () => {
    expect(slugify("Suspicious Lighthouses! ")).toBe("suspicious-lighthouses");
  });
  it("accepts only 1-10 ratings in exact 0.1 steps", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(8.3)).toBe(true);
    expect(isValidRating(10)).toBe(true);
    expect(isValidRating(0.0001)).toBe(false);
    expect(isValidRating(-1)).toBe(false);
    expect(isValidRating(7.25)).toBe(false);
    expect(isValidRating(10.1)).toBe(false);
  });
});
