import type { Client } from "../config/schema.js";
import { isHoliday } from "./holidays.js";
import { type DateRange, eachDayInRange, isWeekend } from "./week.js";

export function workingDaysIn(range: DateRange, holidaysRegion: string): number {
  let count = 0;
  for (const d of eachDayInRange(range)) {
    if (isWeekend(d)) continue;
    if (isHoliday(d, holidaysRegion)) continue;
    count++;
  }
  return count;
}

export function targetDaysFor(client: Client, range: DateRange, holidaysRegion: string): number {
  const wd = workingDaysIn(range, holidaysRegion);
  return (client.targetDaysPerWeek * wd) / 5;
}
