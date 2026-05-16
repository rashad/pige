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

// May 18-24 2026: Mon-Sun, no FR holidays (May 8=Victory, May 14=Ascension, May 25=Pentecost).
const cleanWeek: DateRange = {
  start: new Date(2026, 4, 18),
  end: new Date(2026, 4, 24, 23, 59, 59, 999),
};

// May 11-17 2026: contains Ascension Thursday May 14 (FR public holiday).
const holidayWeek: DateRange = {
  start: new Date(2026, 4, 11),
  end: new Date(2026, 4, 17, 23, 59, 59, 999),
};

// May 2026 full month
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
  it("counts 5 weekdays in a clean week", () => {
    expect(workingDaysIn(cleanWeek, "FR")).toBe(5);
  });
  it("subtracts FR public holidays", () => {
    expect(workingDaysIn(holidayWeek, "FR")).toBe(4);
  });
  it("excludes weekends only", () => {
    expect(workingDaysIn(sundayOnly, "FR")).toBe(0);
  });
});

describe("targetDaysFor", () => {
  it("full-time on a clean week = 5", () => {
    expect(targetDaysFor(fullTime, cleanWeek, "FR")).toBe(5);
  });
  it("full-time on a holiday week = working-day count", () => {
    expect(targetDaysFor(fullTime, holidayWeek, "FR")).toBe(4);
  });
  it("part-time (2 d/w) on a clean week = 2", () => {
    expect(targetDaysFor(partTime, cleanWeek, "FR")).toBe(2);
  });
  it("part-time (2 d/w) on a holiday week = 1.6", () => {
    expect(targetDaysFor(partTime, holidayWeek, "FR")).toBeCloseTo(1.6, 6);
  });
  it("full-time on a calendar month = working days in the month", () => {
    expect(targetDaysFor(fullTime, may2026, "FR")).toBe(workingDaysIn(may2026, "FR"));
  });
  it("part-time on a calendar month = monthly working days × 2 / 5", () => {
    const wd = workingDaysIn(may2026, "FR");
    expect(targetDaysFor(partTime, may2026, "FR")).toBeCloseTo((wd * 2) / 5, 6);
  });
  it("range entirely inside a weekend = 0", () => {
    expect(targetDaysFor(fullTime, sundayOnly, "FR")).toBe(0);
    expect(targetDaysFor(partTime, sundayOnly, "FR")).toBe(0);
  });
});
