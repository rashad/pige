import { describe, expect, it } from "vitest";
import { formatISODate, isoWeekOf, isWeekend, monthRange, weekRange } from "../../src/domain/week.js";

describe("isoWeekOf", () => {
  it("returns 1 for Jan 4 (always week 1)", () => {
    expect(isoWeekOf(new Date("2026-01-04T12:00:00Z"))).toEqual({
      year: 2026,
      week: 1,
    });
  });
  it("returns 53 for late Dec 2026 if applicable", () => {
    // 2026-12-28 is a Monday → ISO week 53 of 2026
    expect(isoWeekOf(new Date("2026-12-28T12:00:00Z"))).toEqual({
      year: 2026,
      week: 53,
    });
  });
  it("handles year boundary (Jan 1 2023 = week 52 of 2022)", () => {
    expect(isoWeekOf(new Date("2023-01-01T12:00:00Z"))).toEqual({
      year: 2022,
      week: 52,
    });
  });
});

describe("weekRange", () => {
  it("returns Mon 00:00 → Sun 23:59:59.999 for a Wed input (local TZ)", () => {
    const range = weekRange(new Date("2026-05-13T15:00:00"));
    expect(formatISODate(range.start)).toBe("2026-05-11"); // Mon
    expect(formatISODate(range.end)).toBe("2026-05-17"); // Sun
  });
});

describe("monthRange", () => {
  it("returns first → last day of the month", () => {
    const range = monthRange(2026, 5); // May 2026
    expect(formatISODate(range.start)).toBe("2026-05-01");
    expect(formatISODate(range.end)).toBe("2026-05-31");
  });
  it("handles February in a leap year", () => {
    const range = monthRange(2028, 2);
    expect(formatISODate(range.end)).toBe("2028-02-29");
  });
});

describe("isWeekend", () => {
  it("true for Sat and Sun", () => {
    expect(isWeekend(new Date("2026-05-16T12:00:00"))).toBe(true); // Sat
    expect(isWeekend(new Date("2026-05-17T12:00:00"))).toBe(true); // Sun
  });
  it("false for Mon-Fri", () => {
    expect(isWeekend(new Date("2026-05-13T12:00:00"))).toBe(false); // Wed
  });
});
