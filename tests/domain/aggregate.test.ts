import { describe, expect, it } from "vitest";
import type { Client } from "../../src/config/schema.js";
import { aggregateEntries } from "../../src/domain/aggregate.js";
import type { TimeEntry } from "../../src/solidtime/types.js";

const clients: Client[] = [
  { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
];

let nextEntryId = 0;
function entry(start: string, durationSec: number, projectId: string): TimeEntry {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + durationSec * 1000);
  return {
    id: `e${++nextEntryId}`,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    duration: durationSec,
    projectId,
    description: "",
    billable: true,
  };
}

describe("aggregateEntries", () => {
  const range = {
    start: new Date(2026, 4, 11), // Mon May 11 2026
    end: new Date(2026, 4, 17, 23, 59, 59, 999),
  };

  it("buckets one full day on the right client", () => {
    const entries = [entry("2026-05-11T08:00:00", 7 * 3600, "p1")];
    const out = aggregateEntries(entries, range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now: new Date("2026-05-13T12:00:00Z"),
    });
    expect(out).toHaveLength(7);
    const mon = out[0]!;
    expect(mon.date).toBe("2026-05-11");
    expect(mon.perClient.get("acme")).toBe(1);
    expect(mon.totalDays).toBe(1);
    expect(mon.dominantClient).toBe("acme");
    expect(mon.isMixed).toBe(false);
  });

  it("marks mixed when ≥2 clients on the same day", () => {
    const entries = [
      entry("2026-05-13T08:00:00", 3.5 * 3600, "p1"),
      entry("2026-05-13T14:00:00", 3.5 * 3600, "p2"),
    ];
    const out = aggregateEntries(entries, range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now: new Date("2026-05-13T12:00:00Z"),
    });
    const wed = out.find((d) => d.date === "2026-05-13")!;
    expect(wed.perClient.get("acme")).toBe(0.5);
    expect(wed.perClient.get("globex")).toBe(0.5);
    expect(wed.isMixed).toBe(true);
    expect(wed.totalDays).toBe(1);
  });

  it("marks weekends", () => {
    const out = aggregateEntries([], range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now: new Date("2026-05-13T12:00:00Z"),
    });
    const sat = out.find((d) => d.date === "2026-05-16")!;
    expect(sat.isWeekend).toBe(true);
  });

  it("unmapped project goes to 'Autres'", () => {
    const entries = [entry("2026-05-12T08:00:00", 7 * 3600, "p_unknown")];
    const out = aggregateEntries(entries, range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now: new Date("2026-05-13T12:00:00Z"),
    });
    const tue = out.find((d) => d.date === "2026-05-12")!;
    expect(tue.perClient.get("__others")).toBe(1);
    expect(tue.dominantClient).toBe("__others");
  });

  it("sums multiple entries for same project on same day", () => {
    const entries = [
      entry("2026-05-11T08:00:00", 3.5 * 3600, "p1"),
      entry("2026-05-11T13:00:00", 3.5 * 3600, "p1"),
    ];
    const out = aggregateEntries(entries, range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now: new Date("2026-05-13T12:00:00Z"),
    });
    expect(out[0]!.perClient.get("acme")).toBe(1);
  });

  it("open entry: substitutes now for missing end and flags the day", () => {
    const now = new Date("2026-05-13T09:30:00Z"); // Wed
    const open: TimeEntry = {
      id: "open1",
      start: "2026-05-13T08:00:00Z",
      end: null,
      duration: null,
      projectId: "p1",
      description: "",
      billable: true,
    };
    const out = aggregateEntries([open], range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now,
    });
    const wed = out.find((d) => d.date === "2026-05-13")!;
    // 1.5 hours elapsed / 7 hours per day = ~0.214 days; hoursToDays rounds to 2 dp → 0.21
    expect(wed.perClient.get("acme")).toBeCloseTo(1.5 / 7, 1);
    expect(wed.hasOpenEntry).toBe(true);
  });

  it("open entry: start outside range is skipped", () => {
    const now = new Date("2026-05-13T09:30:00Z");
    const open: TimeEntry = {
      id: "open2",
      start: "2026-05-09T10:00:00Z", // before range.start (May 11)
      end: null,
      duration: null,
      projectId: "p1",
      description: "",
      billable: true,
    };
    const out = aggregateEntries([open], range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now,
    });
    for (const d of out) {
      expect(d.hasOpenEntry).toBe(false);
      expect(d.totalDays).toBe(0);
    }
  });

  it("open entry: start in the future is skipped", () => {
    const now = new Date("2026-05-13T09:30:00Z");
    const open: TimeEntry = {
      id: "open3",
      start: "2026-05-19T10:00:00Z", // after range.end (May 17)
      end: null,
      duration: null,
      projectId: "p1",
      description: "",
      billable: true,
    };
    const out = aggregateEntries([open], range, clients, {
      hoursPerDay: 7,
      holidaysRegion: "FR",
      now,
    });
    for (const d of out) {
      expect(d.hasOpenEntry).toBe(false);
      expect(d.totalDays).toBe(0);
    }
  });
});
