import { describe, expect, it } from "vitest";
import { minutesToLabel, slugify, yearOf } from "@/lib/utils";

describe("display utilities", () => {
  it("formats runtime and dates", () => {
    expect(minutesToLabel(142)).toBe("2h 22m");
    expect(minutesToLabel(null)).toBe("Runtime TBA");
    expect(yearOf("2026-06-19")).toBe("2026");
  });
  it("creates stable list slugs", () => {
    expect(slugify("Suspicious Lighthouses! ")).toBe("suspicious-lighthouses");
  });
});
