import { afterEach, describe, expect, it, vi } from "vitest";
import { runCal } from "../../src/commands/cal.js";
import type { Config } from "../../src/config/schema.js";
import { createT } from "../../src/i18n.js";
import stripAnsi from "../helpers/stripAnsi.js";

afterEach(() => vi.restoreAllMocks());

const cfg: Config = {
  version: 1,
  solidtime: { baseUrl: "x", organizationId: "org" },
  conversion: { hoursPerDay: 7 },
  clients: [{ id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 }],
  locale: "fr-FR",
  holidaysRegion: "FR",
};

describe("runCal", () => {
  it("prints month grid and totals", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    await runCal(
      { config: cfg, now: new Date(2026, 4, 13), fresh: false, locale: "fr", t: createT("fr") },
      {
        fetchEntries: async () => [
          {
            id: "e1",
            start: "2026-05-05T08:00:00",
            end: "2026-05-05T15:00:00",
            duration: 7 * 3600,
            projectId: "p1",
            description: "",
            billable: true,
          },
        ],
      },
      { year: 2026, month: 5 },
    );
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("Mai 2026");
    expect(out).toContain("Ce mois");
    expect(out).toContain("Semaine");
  });

  it("monthly target is holiday-aware, not × 4.33", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    await runCal(
      { config: cfg, now: new Date(2026, 4, 13), fresh: false, locale: "fr", t: createT("fr") },
      { fetchEntries: async () => [] },
      { year: 2026, month: 5 },
    );
    const out = stripAnsi(logs.join("\n"));
    // May 2026 working days: 21 weekdays − 4 FR public holidays
    // (May 1 Labour Day, May 8 Victory 1945, May 14 Ascension, May 25 Whit Monday) = 17
    // targetDaysPerWeek=3 → 3 × 17 / 5 = 10.2 → rendered as /10.2
    expect(out).toContain("/10.2");
    // The old × 4.33 formula would have produced 3 × 4.33 = 12.99
    expect(out).not.toContain("12.99");
    expect(out).not.toContain("12.9");
  });
});
