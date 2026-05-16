import { describe, expect, it } from "vitest";
import type { Client } from "../../src/config/schema.js";
import { createT } from "../../src/i18n.js";
import { renderMonthSummary, renderWeekSummary } from "../../src/render/summary.js";
import stripAnsi from "../helpers/stripAnsi.js";

const t = createT("fr");

const clients: Client[] = [
  { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
];

describe("renderMonthSummary", () => {
  it("prints label, days, bar and target for each client", () => {
    const totals = new Map<string, number>([
      ["acme", 8.5],
      ["globex", 6.0],
    ]);
    const targets = new Map<string, number>([
      ["acme", 15],
      ["globex", 10],
    ]);
    const out = stripAnsi(renderMonthSummary(totals, targets, clients, t));
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
    const week = new Map<string, number>([
      ["acme", 2.5],
      ["globex", 1.5],
    ]);
    const targets = new Map<string, number>([
      ["acme", 3],
      ["globex", 2],
    ]);
    const out = stripAnsi(renderWeekSummary(week, targets, clients, 20, t));
    expect(out).toContain("Semaine");
    expect(out).toContain("20");
    expect(out).toContain("2.5");
    expect(out).toContain("3.0");
    expect(out).toMatch(/-0\.5|−0\.5/);
  });

  it("uses the passed-in target, not the client field", () => {
    const week = new Map<string, number>([["acme", 1.6]]);
    const targets = new Map<string, number>([["acme", 1.6]]);
    const out = stripAnsi(
      renderWeekSummary(week, targets, [{ ...clients[0]!, targetDaysPerWeek: 2 }], 20, t),
    );
    expect(out).toContain("1.6");
    expect(out).toContain("ok");
  });
});
