import { aggregateEntries, sumPerClient } from "../domain/aggregate.js";
import { formatISODate, isoWeekOf, monthRange, weekRange } from "../domain/week.js";
import { renderMonthlyCalendar } from "../render/calendar.js";
import { renderMonthSummary, renderWeekSummary } from "../render/summary.js";
import type { Context } from "./context.js";
import type { EntrySource } from "./today.js";

export type CalOptions = { year: number; month: number };

export async function runCal(ctx: Context, src: EntrySource, opts: CalOptions): Promise<void> {
  const range = monthRange(opts.year, opts.month);
  const entries = await src.fetchEntries(formatISODate(range.start), formatISODate(range.end));

  const days = aggregateEntries(entries, range, ctx.config.clients, {
    hoursPerDay: ctx.config.conversion.hoursPerDay,
    holidaysRegion: ctx.config.holidaysRegion,
    now: ctx.now,
  });

  console.log(renderMonthlyCalendar(opts.year, opts.month, days, ctx.config.clients, ctx.t, ctx.locale));
  console.log();

  const totals = sumPerClient(days);
  const targets = new Map(ctx.config.clients.map((c) => [c.id, c.targetDaysPerWeek * 4.33] as const));
  console.log(renderMonthSummary(totals, targets, ctx.config.clients, ctx.t));
  console.log();

  if (ctx.now.getFullYear() === opts.year && ctx.now.getMonth() + 1 === opts.month) {
    const wk = weekRange(ctx.now);
    const weekDays = aggregateEntries(entries, wk, ctx.config.clients, {
      hoursPerDay: ctx.config.conversion.hoursPerDay,
      holidaysRegion: ctx.config.holidaysRegion,
      now: ctx.now,
    });
    const weekTotals = sumPerClient(weekDays);
    const { week } = isoWeekOf(ctx.now);
    console.log(renderWeekSummary(weekTotals, ctx.config.clients, week, ctx.t));
  }
}
