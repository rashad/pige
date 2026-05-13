import type { Context } from "./context.js";
import type { TimeEntry } from "../solidtime/types.js";
import { aggregateEntries, sumPerClient } from "../domain/aggregate.js";
import { weekRange, formatISODate, isoWeekOf } from "../domain/week.js";
import { renderWeekSummary } from "../render/summary.js";
import { sectionSeparator } from "../render/box.js";
import { accent, dim } from "../render/palette.js";

export type EntrySource = {
  fetchEntries(fromYmd: string, toYmd: string): Promise<TimeEntry[]>;
};

export async function runToday(ctx: Context, src: EntrySource): Promise<void> {
  const today = ctx.now;
  const week = weekRange(today);
  const entries = await src.fetchEntries(formatISODate(week.start), formatISODate(week.end));

  const days = aggregateEntries(entries, week, ctx.config.clients, {
    hoursPerDay: ctx.config.conversion.hoursPerDay,
    holidaysRegion: ctx.config.holidaysRegion,
  });

  const todayIso = formatISODate(today);
  const todayAgg = days.find((d) => d.date === todayIso);
  const todaySum = todayAgg ? new Map(todayAgg.perClient) : new Map<string, number>();

  console.log(sectionSeparator("Aujourd'hui", 60));
  console.log();
  if (todayAgg && todayAgg.totalDays > 0) {
    for (const c of ctx.config.clients) {
      const v = todaySum.get(c.id) ?? 0;
      if (v > 0) console.log(`   ${accent(c.label.padEnd(10))} ${v.toFixed(2)} j`);
    }
    console.log(`   ${dim("Total :")} ${accent(todayAgg.totalDays.toFixed(2))} j`);
  } else {
    console.log(`   ${dim("Rien enregistré aujourd'hui.")}`);
  }
  console.log();

  const weekTotals = sumPerClient(days);
  const { week: wk } = isoWeekOf(today);
  console.log(renderWeekSummary(weekTotals, ctx.config.clients, wk));
}
