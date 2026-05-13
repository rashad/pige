import { describe, expect, it } from "vitest";
import { holidayName, holidaysForYear, isHoliday } from "../../src/domain/holidays.js";

describe("holidaysForYear (FR)", () => {
  it("contains Bastille Day on July 14", () => {
    const map = holidaysForYear(2026, "FR");
    expect(map.has("2026-07-14")).toBe(true);
  });
  it("contains Christmas", () => {
    const map = holidaysForYear(2026, "FR");
    expect(map.has("2026-12-25")).toBe(true);
  });
  it("contains Easter Monday (mobile holiday)", () => {
    // 2026 Easter is April 5 → Easter Monday April 6
    const map = holidaysForYear(2026, "FR");
    expect(map.has("2026-04-06")).toBe(true);
  });
});

describe("isHoliday / holidayName", () => {
  it("true for July 14 2026", () => {
    expect(isHoliday(new Date("2026-07-14T12:00:00"), "FR")).toBe(true);
    expect(holidayName(new Date("2026-07-14T12:00:00"), "FR")).toMatch(/national|bastille|14/i);
  });
  it("false for a random Tuesday", () => {
    expect(isHoliday(new Date("2026-05-12T12:00:00"), "FR")).toBe(false);
  });
});
