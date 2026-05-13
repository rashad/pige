import type { Client, ClientId } from "../config/schema.js";
import type { TimeEntry } from "../solidtime/types.js";
import { hoursToDays, secondsToHours } from "./convert.js";
import { holidayName, isHoliday } from "./holidays.js";
import { type DateRange, eachDayInRange, formatISODate, isWeekend } from "./week.js";

export const OTHERS_ID = "__others" as const;

export type AggregatedDay = {
  date: string;
  weekday: number; // 0 = Mon
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  perClient: Map<ClientId | typeof OTHERS_ID, number>;
  totalDays: number;
  dominantClient?: ClientId | typeof OTHERS_ID;
  isMixed: boolean;
};

export type AggregateOptions = {
  hoursPerDay: number;
  holidaysRegion: string;
};

export function aggregateEntries(
  entries: TimeEntry[],
  range: DateRange,
  clients: Client[],
  opts: AggregateOptions,
): AggregatedDay[] {
  const projectToClient = new Map<string, ClientId>();
  for (const c of clients) {
    for (const pid of c.solidtimeProjectIds) projectToClient.set(pid, c.id);
  }

  const byDay = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (e.duration == null || e.end == null) continue;
    const date = formatISODate(new Date(e.start));
    const hours = secondsToHours(e.duration);
    const clientId = projectToClient.get(e.projectId) ?? OTHERS_ID;
    let row = byDay.get(date);
    if (!row) {
      row = new Map();
      byDay.set(date, row);
    }
    row.set(clientId, (row.get(clientId) ?? 0) + hours);
  }

  return eachDayInRange(range).map((d) => {
    const date = formatISODate(d);
    const weekday = (d.getDay() + 6) % 7;
    const hRow = byDay.get(date) ?? new Map<string, number>();
    const perClient = new Map<string, number>();
    let total = 0;
    for (const [cid, hours] of hRow) {
      const days = hoursToDays(hours, opts.hoursPerDay);
      perClient.set(cid, days);
      total += days;
    }
    total = Math.round(total * 100) / 100;

    let dominant: string | undefined;
    let maxVal = 0;
    for (const [cid, days] of perClient) {
      if (days > maxVal) {
        maxVal = days;
        dominant = cid;
      }
    }
    const nonZero = [...perClient.values()].filter((v) => v > 0).length;

    return {
      date,
      weekday,
      isWeekend: isWeekend(d),
      isHoliday: isHoliday(d, opts.holidaysRegion),
      holidayName: holidayName(d, opts.holidaysRegion),
      perClient,
      totalDays: total,
      dominantClient: dominant,
      isMixed: nonZero >= 2,
    };
  });
}

export function sumPerClient(days: AggregatedDay[]): Map<string, number> {
  const sum = new Map<string, number>();
  for (const d of days) {
    for (const [cid, v] of d.perClient) {
      sum.set(cid, Math.round(((sum.get(cid) ?? 0) + v) * 100) / 100);
    }
  }
  return sum;
}
