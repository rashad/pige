import { describe, it, expect } from "vitest";
import { renderMonthlyCalendar } from "../../src/render/calendar.js";
import type { AggregatedDay } from "../../src/domain/aggregate.js";
import type { Client } from "../../src/config/schema.js";
import stripAnsi from "../helpers/stripAnsi.js";

const clients: Client[] = [
  { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
];

function emptyDay(date: string, weekday: number, isWeekend: boolean): AggregatedDay {
  return {
    date, weekday, isWeekend, isHoliday: false,
    perClient: new Map(), totalDays: 0, isMixed: false,
  };
}

describe("renderMonthlyCalendar", () => {
  it("renders a header with month and year", () => {
    const days: AggregatedDay[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 4, d);
      days.push(emptyDay(`2026-05-${String(d).padStart(2, "0")}`, (date.getDay() + 6) % 7, [0,6].includes(date.getDay())));
    }
    const out = stripAnsi(renderMonthlyCalendar(2026, 5, days, clients));
    expect(out).toContain("Mai 2026");
    expect(out).toContain("Lun");
    expect(out).toContain("Dim");
  });

  it("places day 1 under the correct weekday column", () => {
    const days: AggregatedDay[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 4, d);
      days.push(emptyDay(`2026-05-${String(d).padStart(2, "0")}`, (date.getDay() + 6) % 7, [0,6].includes(date.getDay())));
    }
    const out = stripAnsi(renderMonthlyCalendar(2026, 5, days, clients));
    // May 1 2026 is a Friday. The line containing " 1" should also contain " 2" (Sat) and " 3" (Sun).
    const line = out.split("\n").find((l) => / 1 /.test(l) || / 1$/.test(l));
    expect(line).toBeTruthy();
    expect(line!).toMatch(/ 1.* 2.* 3/);
  });

  it("renders count of days worked in title (right side)", () => {
    const days: AggregatedDay[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 4, d);
      const wd = (date.getDay() + 6) % 7;
      const we = [0,6].includes(date.getDay());
      const day = emptyDay(`2026-05-${String(d).padStart(2, "0")}`, wd, we);
      if (!we && d <= 15) {
        day.perClient.set("acme", 1);
        day.totalDays = 1;
        day.dominantClient = "acme";
      }
      days.push(day);
    }
    const out = stripAnsi(renderMonthlyCalendar(2026, 5, days, clients));
    expect(out).toMatch(/11 \/ 21 jours|11\/21/);
  });
});
