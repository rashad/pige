import { describe, it, expect, vi, afterEach } from "vitest";
import { runWeek } from "../../src/commands/week.js";
import type { Config } from "../../src/config/schema.js";
import { createT } from "../../src/i18n.js";
import stripAnsi from "../helpers/stripAnsi.js";

afterEach(() => vi.restoreAllMocks());

const cfg: Config = {
  version: 1,
  solidtime: { baseUrl: "x", organizationId: "org" },
  conversion: { hoursPerDay: 7 },
  clients: [
    { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
    { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
  ],
  locale: "fr-FR", holidaysRegion: "FR",
};

describe("runWeek", () => {
  it("prints one line per day Mon→Sun with client breakdown", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => { logs.push(s); });
    await runWeek({ config: cfg, now: new Date(2026, 4, 13), fresh: false, locale: "fr", t: createT("fr") }, {
      fetchEntries: async () => [
        { id: "e1", start: "2026-05-11T08:00:00", end: "2026-05-11T15:00:00", duration: 7*3600, projectId: "p1", description: "", billable: true },
        { id: "e2", start: "2026-05-13T08:00:00", end: "2026-05-13T11:30:00", duration: 3.5*3600, projectId: "p1", description: "", billable: true },
        { id: "e3", start: "2026-05-13T14:00:00", end: "2026-05-13T17:30:00", duration: 3.5*3600, projectId: "p2", description: "", billable: true },
      ],
    });
    const out = stripAnsi(logs.join("\n"));
    expect(out).toMatch(/Lun.*11/);
    expect(out).toMatch(/Mer.*13/);
    expect(out).toContain("Acme");
    expect(out).toContain("Globex");
  });
});
