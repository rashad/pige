import { describe, it, expect } from "vitest";
import { hoursToDays, secondsToHours } from "../../src/domain/convert.js";

describe("hoursToDays", () => {
  it("returns 0 for 0 hours", () => {
    expect(hoursToDays(0, 7)).toBe(0);
  });
  it("returns 1 for 7 hours at 7h/day", () => {
    expect(hoursToDays(7, 7)).toBe(1);
  });
  it("returns 0.5 for 3.5 hours at 7h/day", () => {
    expect(hoursToDays(3.5, 7)).toBe(0.5);
  });
  it("returns 2 for 14 hours at 7h/day", () => {
    expect(hoursToDays(14, 7)).toBe(2);
  });
  it("rounds to 2 decimals", () => {
    expect(hoursToDays(2.3333333, 7)).toBeCloseTo(0.33, 2);
  });
  it("throws on hoursPerDay <= 0", () => {
    expect(() => hoursToDays(7, 0)).toThrow();
  });
});

describe("secondsToHours", () => {
  it("converts seconds to hours", () => {
    expect(secondsToHours(3600)).toBe(1);
    expect(secondsToHours(12600)).toBe(3.5);
    expect(secondsToHours(0)).toBe(0);
  });
});
