import { aggregateEntries, sumPerClient } from "../domain/aggregate.js";
import { targetDaysFor } from "../domain/targets.js";
import { formatISODate, isoWeekOf, weekRange } from "../domain/week.js";
import { sectionSeparator } from "../render/box.js";
import { accent, dim } from "../render/palette.js";
import { renderWeekSummary } from "../render/summary.js";
import type { TimeEntry } from "../solidtime/types.js";
import type { Context } from "./context.js";

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
    now: ctx.now,
  });

  const todayIso = formatISODate(today);
  const todayAgg = days.find((d) => d.date === todayIso);
  const todaySum = todayAgg ? new Map(todayAgg.perClient) : new Map<string, number>();

  console.log(sectionSeparator(ctx.t("today.title"), 60));
  console.log();
  if (todayAgg && todayAgg.totalDays > 0) {
    for (const c of ctx.config.clients) {
      const v = todaySum.get(c.id) ?? 0;
      if (v > 0) console.log(`   ${accent(c.label.padEnd(10))} ${v.toFixed(2)} ${ctx.t("unit.day")}`);
    }
    const openMark = todayAgg.hasOpenEntry ? ` ${ctx.t("today.openEntry")}` : "";
    console.log(
      `   ${dim(ctx.t("today.total"))} ${accent(todayAgg.totalDays.toFixed(2))} ${ctx.t("unit.day")}${openMark}`,
    );
    if (todayAgg.hasOpenEntry) {
      console.log(`   ${dim(ctx.t("today.useFresh"))}`);
    }
  } else {
    console.log(`   ${dim(ctx.t("today.nothing"))}`);
  }
  console.log();

  const weekTotals = sumPerClient(days);
  const { week: wk } = isoWeekOf(today);
  const weekTargets = new Map(ctx.config.clients.map((c) => [c.id, targetDaysFor(c, week)] as const));
  console.log(renderWeekSummary(weekTotals, weekTargets, ctx.config.clients, wk, ctx.t));
}
