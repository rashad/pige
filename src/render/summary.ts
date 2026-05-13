import type { Client } from "../config/schema.js";
import type { T } from "../i18n.js";
import { sectionSeparator } from "./box.js";
import { progressBar } from "./bars.js";
import { accent, dim } from "./palette.js";

const WIDTH = 60;

export function renderMonthSummary(
  totals: Map<string, number>,
  targets: Map<string, number>,
  clients: Client[],
  t: T,
): string {
  const lines: string[] = [sectionSeparator(t("summary.monthTitle"), WIDTH), ""];
  for (const c of clients) {
    const days = totals.get(c.id) ?? 0;
    const target = targets.get(c.id) ?? 0;
    const bar = progressBar(days, Math.max(target, 1), 16, c.color);
    const pct = target > 0 ? `${Math.round((days / target) * 100)} %` : "—";
    lines.push(
      `   ${accent(c.label.padEnd(10))} ${days.toFixed(1).padStart(5)} j   ${bar}  ${dim(`/${target}`)}  ${dim(pct.padStart(5))}`,
    );
  }
  return lines.join("\n");
}

export function renderWeekSummary(
  week: Map<string, number>,
  clients: Client[],
  weekNumber: number,
  t: T,
): string {
  const lines: string[] = [sectionSeparator(t("summary.weekTitle", { week: weekNumber }), WIDTH), ""];
  let total = 0;
  for (const c of clients) {
    const days = week.get(c.id) ?? 0;
    total += days;
    const tgt = c.targetDaysPerWeek;
    const bar = progressBar(days, Math.max(tgt, 1), 16, c.color);
    const delta = days - tgt;
    const deltaStr =
      delta === 0 ? dim(t("summary.ok")) :
      delta < 0   ? dim(`−${Math.abs(delta).toFixed(1)}`) :
                    accent(`+${delta.toFixed(1)}`);
    lines.push(
      `   ${accent(c.label.padEnd(10))} ${days.toFixed(1)} / ${tgt.toFixed(1)} j   ${bar}  ${deltaStr}`,
    );
  }
  lines.push("", `   ${dim(t("summary.weekTotal"))} ${accent(total.toFixed(1))} j`);
  return lines.join("\n");
}
