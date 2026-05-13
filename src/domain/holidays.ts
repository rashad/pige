import HolidaysCJS from "date-holidays";
import { formatISODate } from "./week.js";

// date-holidays is CJS; handle both ESM interop and direct default.
type HolidaysCtor = new (region: string) => { getHolidays(year: number): HolidayEntry[] | undefined };

type HolidayEntry = { date: string; name: string; type: string };

const Holidays =
  (HolidaysCJS as unknown as { default?: HolidaysCtor }).default ?? (HolidaysCJS as unknown as HolidaysCtor);

const cache = new Map<string, Map<string, string>>();

export function holidaysForYear(year: number, region: string): Map<string, string> {
  const key = `${region}-${year}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const hd = new Holidays(region);
  const list = hd.getHolidays(year) ?? [];
  const map = new Map<string, string>();
  for (const h of list) {
    if (h.type !== "public") continue;
    const d = new Date(h.date);
    map.set(formatISODate(d), h.name);
  }
  cache.set(key, map);
  return map;
}

export function isHoliday(d: Date, region: string): boolean {
  return holidaysForYear(d.getFullYear(), region).has(formatISODate(d));
}

export function holidayName(d: Date, region: string): string | undefined {
  return holidaysForYear(d.getFullYear(), region).get(formatISODate(d));
}
