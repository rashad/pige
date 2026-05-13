import type { Client } from "../config/schema.js";
import type { AggregatedDay } from "../domain/aggregate.js";
import type { Locale, T } from "../i18n.js";
import { MONTHS, WEEKDAYS } from "../i18n.js";
import { roundedBox } from "./box.js";
import { clientCell, dim, emptyCell, neutralCell } from "./palette.js";

const CAL_WIDTH = 60;

export function renderMonthlyCalendar(
  year: number,
  month1to12: number,
  days: AggregatedDay[],
  clients: Client[],
  t: T,
  locale: Locale,
): string {
  const monthName = MONTHS[locale][month1to12 - 1] ?? "";
  const businessDays = days.filter((d) => !d.isWeekend && !d.isHoliday).length;
  const workedDays = days.filter((d) => d.totalDays > 0).length;
  const title = `pige · ${monthName} ${year}`;
  const rightHud = t("calendar.daysHud", { worked: workedDays, business: businessDays });
  const titlePadded =
    title + " ".repeat(Math.max(1, CAL_WIDTH - 4 - title.length - rightHud.length)) + rightHud;

  const header = roundedBox(titlePadded, CAL_WIDTH);

  const headerLine = `   ${WEEKDAYS[locale].map((w) => dim(w.padStart(4, " "))).join("  ")}`;

  const first = days[0];
  const leading = first ? first.weekday : 0;
  const cells: string[] = [];
  for (let i = 0; i < leading; i++) cells.push("    ");
  for (const d of days) cells.push(renderDayCell(d, clients));
  while (cells.length % 7 !== 0) cells.push("    ");

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`   ${cells.slice(i, i + 7).join("  ")}`);
  }

  return [header, "", headerLine, "", ...rows].join("\n");
}

function renderDayCell(d: AggregatedDay, clients: Client[]): string {
  const num = String(parseInt(d.date.slice(-2), 10)).padStart(2, " ");
  const text = ` ${num} `; // 4 chars wide

  if (d.isWeekend || d.isHoliday) return neutralCell(text);
  if (d.totalDays === 0) return emptyCell(text);

  const dominantClient = clients.find((c) => c.id === d.dominantClient);
  if (!dominantClient) return emptyCell(text);
  const display = d.isMixed ? ` ${num}·` : text;
  return clientCell(display, dominantClient.color);
}
