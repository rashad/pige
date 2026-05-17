import type { Client } from "../config/schema.js";
import { type DateRange, eachDayInRange, isWeekend } from "./week.js";

export function workingDaysIn(range: DateRange): number {
  let count = 0;
  for (const d of eachDayInRange(range)) {
    if (isWeekend(d)) continue;
    count++;
  }
  return count;
}

export function targetDaysFor(client: Client, range: DateRange): number {
  const wd = workingDaysIn(range);
  return (client.targetDaysPerWeek * wd) / 5;
}
