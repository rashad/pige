import { aggregateEntries, sumPerClient } from "../domain/aggregate.js";
import { targetDaysFor } from "../domain/targets.js";
import { formatISODate, isoWeekOf, weekRange } from "../domain/week.js";
import { WEEKDAYS } from "../i18n.js";
import { sectionSeparator } from "../render/box.js";
import { accent, clientCell, dim, emptyCell, neutralCell } from "../render/palette.js";
import { renderWeekSummary } from "../render/summary.js";
import type { Context } from "./context.js";
import type { EntrySource } from "./today.js";

export async function runWeek(ctx: Context, src: EntrySource, opts?: { date?: Date }): Promise<void> {
  const anchor = opts?.date ?? ctx.now;
  const range = weekRange(anchor);
  const entries = await src.fetchEntries(formatISODate(range.start), formatISODate(range.end));
  const days = aggregateEntries(entries, range, ctx.config.clients, {
    hoursPerDay: ctx.config.conversion.hoursPerDay,
    holidaysRegion: ctx.config.holidaysRegion,
    now: ctx.now,
  });
  const { week } = isoWeekOf(anchor);

  console.log(sectionSeparator(ctx.t("week.title", { week }), 60));
  console.log();

  for (const d of days) {
    const dn = parseInt(d.date.slice(-2), 10);
    const wdName = WEEKDAYS[ctx.locale][d.weekday] ?? "?";
    const label = `${wdName} ${String(dn).padStart(2, " ")}`;
    let cell: string;
    if (d.isHoliday) cell = neutralCell(` ${dn} `);
    else if (d.isWeekend) cell = neutralCell(` ${dn} `);
    else if (d.totalDays === 0) cell = emptyCell(` ${dn} `);
    else {
      const dom = ctx.config.clients.find((c) => c.id === d.dominantClient);
      cell = dom ? clientCell(` ${dn} `, dom.color) : emptyCell(` ${dn} `);
    }
    const fractions = ctx.config.clients
      .map((c) => {
        const v = d.perClient.get(c.id) ?? 0;
        return v > 0 ? `${c.label} ${v.toFixed(2)}j` : null;
      })
      .filter((x): x is string => x !== null)
      .join("  ");
    console.log(`   ${cell}  ${accent(label)}   ${dim(fractions || ctx.t("week.empty"))}`);
  }

  console.log();
  const totals = sumPerClient(days);
  const weekTargets = new Map(
    ctx.config.clients.map((c) => [c.id, targetDaysFor(c, range, ctx.config.holidaysRegion)] as const),
  );
  console.log(renderWeekSummary(totals, weekTargets, ctx.config.clients, week, ctx.t));
}
