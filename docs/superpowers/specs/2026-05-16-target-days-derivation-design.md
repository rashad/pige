# Calendar-aware target derivation — design

Date: 2026-05-16
Backlog item: #2 (reframed)

## Problem

The backlog asked for `targetDaysPerMonth` alongside `targetDaysPerWeek` per client. Walking through the user's actual mental model revealed a better answer: the target shouldn't be a hard-coded number per cadence, it should be derived from the **contract** (days per week the client is owed) and the **calendar** (working days in the relevant period). Two pieces of evidence the current model is wrong:

- `src/commands/cal.ts:23` synthesises a monthly target as `targetDaysPerWeek × 4.33`. The `4.33` is a crude average and ignores holidays entirely — a French month with two public holidays still gets the same "expected" total as one with none.
- A "full-time" client has no clean expression in the current schema. The user has to pick a `targetDaysPerWeek` value (`5`?) and accept that the monthly figure won't reflect actual working days.

## Goal

Derive the target days for any period (week, month, custom range) from one stored field — `targetDaysPerWeek` — and the project's existing working-day calculation. No new field. No second number to keep in sync.

## Non-goals

- Renaming `targetDaysPerWeek`. (Considered, declined; the field name is fine and a rename is migration churn for no functional gain.)
- Implementing the week-view "remaining time to quota" feature (backlog item #8). That feature *consumes* this derivation but is scoped separately.
- Changing how `isHoliday`, `isWeekend`, or `holidaysRegion` work. We're reading their output, not modifying them.
- Per-client overrides for holiday calendars. One region per config, same as today.

## Design

### The formula

For any client and any date range:

```
targetDaysFor(client, range) = client.targetDaysPerWeek × workingDaysIn(range) / 5
```

Where `workingDaysIn(range)` is the count of days in `range` that are neither weekends nor holidays (per the configured region).

Properties this gives us:

- **Full-time** is `targetDaysPerWeek = 5`. The formula collapses: `5 × W / 5 = W` working days exactly. The user gets the calendar's truth, free of the `4.33` approximation.
- **Per-week contracts** auto-prorate around holidays. A 2-days/week client during a week with a public holiday on Wednesday gets `2 × 4 / 5 = 1.6` days expected. This matches the intent ("I owe them 2 days of attention out of a normal 5-day week; the holiday reduces the available week proportionally").
- **Any range** works — daily, weekly, monthly, quarterly, custom — without a separate field per cadence.

### New module: `src/domain/targets.ts`

```ts
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

export function targetDaysFor(
  client: Client,
  range: DateRange,
  holidaysRegion: string,
): number {
  const wd = workingDaysIn(range, holidaysRegion);
  return (client.targetDaysPerWeek * wd) / 5;
}
```

Pure. No I/O. Lives next to the other `domain/*` modules.

### Call site changes

**`src/commands/cal.ts`** (line 23 today):

```diff
- const targets = new Map(ctx.config.clients.map((c) => [c.id, c.targetDaysPerWeek * 4.33] as const));
+ const targets = new Map(
+   ctx.config.clients.map((c) => [c.id, targetDaysFor(c, range, ctx.config.holidaysRegion)] as const),
+ );
```

The `range` here is the month range already computed earlier in the file. No new arguments threaded.

**`src/render/summary.ts`** (line 39 today):

`renderWeekSummary` currently reads `c.targetDaysPerWeek` directly. It will mirror `renderMonthSummary`'s shape (which already takes `targets: Map<string, number>`):

```diff
 export function renderWeekSummary(
   week: Map<string, number>,
+  targets: Map<string, number>,
   clients: Client[],
   weekNumber: number,
   t: T,
 ) {
   ...
-    const tgt = c.targetDaysPerWeek;
+    const tgt = targets.get(c.id) ?? 0;
```

The render layer stays pure (no `holidaysRegion`, no `DateRange`). `commands/week.ts` precomputes the map with `targetDaysFor` and passes it in, exactly like `cal.ts` does for the month target.

### Wizard copy

`src/commands/config.ts` prompt for `targetDaysPerWeek` is updated to clarify the semantics. From the current bare "Target days per week" prompt to:

> "How many days per week does this client get? (5 = full-time, otherwise the number of days/week in the contract)"

Both `en` and `fr` versions added to `src/i18n.ts`. No new keys for the formula itself — targets are numbers, not strings.

### Schema

**No change.** `targetDaysPerWeek` stays a required `number` on `Client`. No new field, no migration, no version bump.

## Tests

### `tests/domain/targets.test.ts` — new file

1. **Full-time on a clean week** — `daysPerWeek=5`, week with no holidays → target = 5.
2. **Full-time on a holiday week** — `daysPerWeek=5`, week with one FR holiday → target = 4.
3. **Part-time on a clean week** — `daysPerWeek=2`, no holidays → target = 2.
4. **Part-time on a holiday week** — `daysPerWeek=2`, week with one holiday → target = 1.6.
5. **Full-time on a calendar month** — `daysPerWeek=5`, May 2026 (count working days, subtract FR holidays) → target equals the working-day count.
6. **Part-time on a calendar month** — `daysPerWeek=3`, same month → target = 3 × working-days / 5.
7. **Range entirely inside a single weekend** — target = 0 regardless of `daysPerWeek`.
8. **Empty range** (`start > end`) — target = 0, no throw. (Defensive — shouldn't happen via normal calls.)

### `tests/commands/cal.test.ts` — update

The existing snapshot will change because the monthly target now reflects holidays. Update the snapshot, add an assertion that a known-holiday month produces a strictly smaller target than the same month without holidays would.

### `tests/render/summary.test.ts` — update

Update fixtures to pass through `holidaysRegion` (or the precomputed target map, depending on the signature chosen). Add one case for a holiday week to lock in the new behaviour.

## Docs

`README.md` — short paragraph under the "Config" section explaining the model:

> Per-client `targetDaysPerWeek` is both a weekly target and the basis for monthly expectations. Set `5` for full-time clients (you'll be expected every working day, holidays automatically excluded), or a smaller number like `2` for partial contracts. Monthly and weekly views derive their expected totals from this value and the working days in the period.

## Risk

- `targetDaysFor` introduces a non-integer result (`2 × 4 / 5 = 1.6`). The week summary and calendar already render `toFixed(2)` formatted decimals, so no display issue, but the user may be momentarily confused by fractional expected days. Mitigated by the README paragraph.
- Snapshot test updates for `cal.test.ts` will produce a churn diff. Worth it — the previous snapshot enshrined the `4.33` bug.
- `summary.ts` signature change ripples to its (few) callers. All in-tree; no external consumers.

## Out of scope (revisit later)

- "Remaining time to quota" UI (backlog #8) — separate spec, builds on this one.
- Per-client holiday region overrides.
- Pro-rating partial-day holidays (half-day public holidays don't exist in FR; revisit if/when another region is added).
- Allowing `targetDaysPerWeek > 5` (overtime contracts). The formula handles it mathematically, but the wizard should reject it for now; cheaper to add a validation later than to define the semantics now.
