import { describe, expect, it } from "vitest";
import type { Client } from "../../src/config/schema.js";
import { targetDaysFor, workingDaysIn } from "../../src/domain/targets.js";
import type { DateRange } from "../../src/domain/week.js";

const fullTime: Client = {
  id: "acme",
  solidtimeProjectIds: ["p1"],
  label: "Acme",
  color: "blue",
  targetDaysPerWeek: 5,
};

const partTime: Client = { ...fullTime, id: "globex", label: "Globex", targetDaysPerWeek: 2 };

// May 18-24 2026: Mon-Sun, 5 weekdays.
const cleanWeek: DateRange = {
  start: new Date(2026, 4, 18),
  end: new Date(2026, 4, 24, 23, 59, 59, 999),
};

// May 11-17 2026: Mon-Sun, 5 weekdays (Ascension on May 14 no longer subtracted).
const weekWithHoliday: DateRange = {
  start: new Date(2026, 4, 11),
  end: new Date(2026, 4, 17, 23, 59, 59, 999),
};

// May 2026 full month: 21 weekdays (Mon-Fri, ignoring public holidays).
const may2026: DateRange = {
  start: new Date(2026, 4, 1),
  end: new Date(2026, 4, 31, 23, 59, 59, 999),
};

// A single Sunday (May 24 2026)
const sundayOnly: DateRange = {
  start: new Date(2026, 4, 24),
  end: new Date(2026, 4, 24, 23, 59, 59, 999),
};

describe("workingDaysIn", () => {
  it("counts 5 weekdays in a standard week", () => {
    expect(workingDaysIn(cleanWeek)).toBe(5);
  });
  it("counts 5 weekdays even in a week with a public holiday", () => {
    expect(workingDaysIn(weekWithHoliday)).toBe(5);
  });
  it("excludes weekends only", () => {
    expect(workingDaysIn(sundayOnly)).toBe(0);
  });
  it("counts 21 weekdays in May 2026", () => {
    expect(workingDaysIn(may2026)).toBe(21);
  });
});

describe("targetDaysFor", () => {
  it("full-time on a standard week = 5", () => {
    expect(targetDaysFor(fullTime, cleanWeek)).toBe(5);
  });
  it("full-time on a week with a public holiday = 5 (holidays ignored)", () => {
    expect(targetDaysFor(fullTime, weekWithHoliday)).toBe(5);
  });
  it("part-time (2 d/w) on a standard week = 2", () => {
    expect(targetDaysFor(partTime, cleanWeek)).toBe(2);
  });
  it("part-time (2 d/w) on a week with a public holiday = 2", () => {
    expect(targetDaysFor(partTime, weekWithHoliday)).toBe(2);
  });
  it("full-time on May 2026 = 21", () => {
    expect(targetDaysFor(fullTime, may2026)).toBe(21);
  });
  it("part-time on May 2026 = 21 × 2 / 5 = 8.4", () => {
    expect(targetDaysFor(partTime, may2026)).toBeCloseTo(8.4, 6);
  });
  it("range entirely inside a weekend = 0", () => {
    expect(targetDaysFor(fullTime, sundayOnly)).toBe(0);
    expect(targetDaysFor(partTime, sundayOnly)).toBe(0);
  });
});
