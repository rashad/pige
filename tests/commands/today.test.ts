import { afterEach, describe, expect, it, vi } from "vitest";
import { runToday } from "../../src/commands/today.js";
import type { Config } from "../../src/config/schema.js";
import { createT } from "../../src/i18n.js";
import stripAnsi from "../helpers/stripAnsi.js";

afterEach(() => vi.restoreAllMocks());

const cfg: Config = {
  version: 1,
  solidtime: { baseUrl: "https://app.solidtime.io/api", organizationId: "org" },
  conversion: { hoursPerDay: 7 },
  clients: [{ id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 }],
  locale: "fr-FR",
  holidaysRegion: "FR",
};

describe("runToday", () => {
  it("prints today and week sections using injected entries", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    await runToday(
      { config: cfg, now: new Date(2026, 4, 13, 10), fresh: false, locale: "fr", t: createT("fr") },
      {
        fetchEntries: async () => [
          {
            id: "e1",
            start: "2026-05-13T08:00:00",
            end: "2026-05-13T15:00:00",
            duration: 7 * 3600,
            projectId: "p1",
            description: "",
            billable: true,
          },
        ],
      },
    );
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("Aujourd'hui");
    expect(out).toContain("Acme");
    expect(out).toContain("Semaine");
    expect(out).not.toContain("…");
    expect(out).not.toContain("--fresh");
  });

  it("shows … and the use-fresh hint when today has an open entry", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    const now = new Date(2026, 4, 13, 11, 0, 0); // Wed 11:00 local
    await runToday(
      { config: cfg, now, fresh: false, locale: "fr", t: createT("fr") },
      {
        fetchEntries: async () => [
          {
            id: "open",
            start: new Date(2026, 4, 13, 9, 30, 0).toISOString(), // started 90 min ago
            end: null,
            duration: null,
            projectId: "p1",
            description: "",
            billable: true,
          },
        ],
      },
    );
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("…");
    expect(out).toContain("--fresh");
  });
});
