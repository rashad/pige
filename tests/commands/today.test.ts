import { describe, it, expect, vi, afterEach } from "vitest";
import { runToday } from "../../src/commands/today.js";
import type { Config } from "../../src/config/schema.js";
import stripAnsi from "../helpers/stripAnsi.js";

afterEach(() => vi.restoreAllMocks());

const cfg: Config = {
  version: 1,
  solidtime: { baseUrl: "https://app.solidtime.io/api", organizationId: "org" },
  conversion: { hoursPerDay: 7 },
  clients: [
    { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  ],
  locale: "fr-FR",
  holidaysRegion: "FR",
};

describe("runToday", () => {
  it("prints today and week sections using injected entries", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => { logs.push(s); });
    await runToday({ config: cfg, now: new Date(2026, 4, 13, 10), fresh: false }, {
      fetchEntries: async () => [
        { id: "e1", start: "2026-05-13T08:00:00", end: "2026-05-13T15:00:00", duration: 7*3600, projectId: "p1", description: "", billable: true },
      ],
    });
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("Aujourd'hui");
    expect(out).toContain("Acme");
    expect(out).toContain("Semaine");
  });
});
