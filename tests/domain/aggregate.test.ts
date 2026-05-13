import { describe, it, expect } from "vitest";
import { aggregateEntries } from "../../src/domain/aggregate.js";
import type { TimeEntry } from "../../src/solidtime/types.js";
import type { Client } from "../../src/config/schema.js";

const clients: Client[] = [
  { id: "acme", solidtimeProjectIds: ["p1"], label: "Acme", color: "blue", targetDaysPerWeek: 3 },
  { id: "globex", solidtimeProjectIds: ["p2"], label: "Globex", color: "green", targetDaysPerWeek: 2 },
];

function entry(start: string, durationSec: number, projectId: string): TimeEntry {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + durationSec * 1000);
  return {
    id: Math.random().toString(),
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
    const out = aggregateEntries(entries, range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    expect(out).toHaveLength(7);
    const mon = out[0];
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
    const out = aggregateEntries(entries, range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    const wed = out.find((d) => d.date === "2026-05-13")!;
    expect(wed.perClient.get("acme")).toBe(0.5);
    expect(wed.perClient.get("globex")).toBe(0.5);
    expect(wed.isMixed).toBe(true);
    expect(wed.totalDays).toBe(1);
  });

  it("marks weekends", () => {
    const out = aggregateEntries([], range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    const sat = out.find((d) => d.date === "2026-05-16")!;
    expect(sat.isWeekend).toBe(true);
  });

  it("unmapped project goes to 'Autres'", () => {
    const entries = [entry("2026-05-12T08:00:00", 7 * 3600, "p_unknown")];
    const out = aggregateEntries(entries, range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    const tue = out.find((d) => d.date === "2026-05-12")!;
    expect(tue.perClient.get("__others")).toBe(1);
    expect(tue.dominantClient).toBe("__others");
  });

  it("sums multiple entries for same project on same day", () => {
    const entries = [
      entry("2026-05-11T08:00:00", 3.5 * 3600, "p1"),
      entry("2026-05-11T13:00:00", 3.5 * 3600, "p1"),
    ];
    const out = aggregateEntries(entries, range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    expect(out[0].perClient.get("acme")).toBe(1);
  });

  it("running entry (end null) is ignored", () => {
    const e: TimeEntry = {
      id: "x",
      start: "2026-05-11T08:00:00.000Z",
      end: null,
      duration: null,
      projectId: "p1",
      description: "",
      billable: true,
    };
    const out = aggregateEntries([e], range, clients, { hoursPerDay: 7, holidaysRegion: "FR" });
    expect(out[0].totalDays).toBe(0);
  });
});
