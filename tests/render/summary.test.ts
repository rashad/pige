import { describe, it, expect } from "vitest";
import { renderMonthSummary, renderWeekSummary } from "../../src/render/summary.js";
import type { Client } from "../../src/config/schema.js";
import stripAnsi from "../helpers/stripAnsi.js";

const clients: Client[] = [
  { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
];

describe("renderMonthSummary", () => {
  it("prints label, days, bar and target for each client", () => {
    const totals = new Map<string, number>([["acme", 8.5], ["globex", 6.0]]);
    const targets = new Map<string, number>([["acme", 15], ["globex", 10]]);
    const out = stripAnsi(renderMonthSummary(totals, targets, clients));
    expect(out).toContain("Acme");
    expect(out).toContain("8.5");
    expect(out).toContain("/15");
    expect(out).toContain("Globex");
    expect(out).toContain("6.0");
    expect(out).toContain("/10");
  });
});

describe("renderWeekSummary", () => {
  it("shows delta vs target per client", () => {
    const week = new Map<string, number>([["acme", 2.5], ["globex", 1.5]]);
    const out = stripAnsi(renderWeekSummary(week, clients, 20));
    expect(out).toContain("Semaine");
    expect(out).toContain("20");
    expect(out).toContain("2.5");
    expect(out).toContain("3.0");
    expect(out).toMatch(/-0\.5|−0\.5/);
  });
});
