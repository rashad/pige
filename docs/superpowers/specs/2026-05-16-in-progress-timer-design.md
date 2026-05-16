# In-progress timer inclusion — design

Date: 2026-05-16
Backlog item: #7

## Problem

Solidtime entries for a running timer have no `end` time. The aggregation layer (`src/domain/aggregate.ts:39`) explicitly drops every entry where `e.end == null`, so `pige today`, `pige week`, and `pige cal` under-report hours whenever a session is active. A user with a 3-hour open timer sees zero contribution from it until they stop the timer in Solidtime and re-sync.

## Goal

When an entry has no `end`, treat it as ending at "now" before aggregating, so views reflect the running session. The user gets a visible, lightweight cue that today's figure includes a live timer.

## Non-goals

- Changing the cache TTL or the offline-first behaviour.
- Surfacing the open-entry marker in the week summary or the calendar grid.
- Adding any second clock or auto-refresh loop.
- Modifying `src/solidtime/client.ts`. The HTTP layer stays oblivious; loose-equality (`== null`) at the aggregation site already handles both `end: null` and a missing `end` field. (Spike: a quick `pige sync --fresh` against a running timer will confirm which form the API returns — the result becomes a one-line footnote in this doc, not a code change.)

## Design

### Aggregation layer — `src/domain/aggregate.ts`

`AggregateOptions` gains a `now: Date` field:

```ts
export type AggregateOptions = {
  hoursPerDay: number;
  holidaysRegion: string;
  now: Date;
};
```

All call sites already have `ctx.now` available, so propagation is trivial.

The current early-skip in `aggregateEntries`:

```ts
if (e.duration == null || e.end == null) continue;
```

is replaced with substitution-or-skip logic:

```ts
let durationSec = e.duration;
let openOnDate: string | null = null;
if (e.end == null) {
  const start = new Date(e.start);
  // Only substitute if the entry started within the requested range.
  // A malformed open entry outside the range is skipped rather than back-filled.
  if (start < range.start || start > range.end) continue;
  durationSec = Math.max(0, Math.floor((opts.now.getTime() - start.getTime()) / 1000));
  openOnDate = formatISODate(start);
}
if (durationSec == null) continue;
```

(`DateRange` is `{ start: Date; end: Date }` — see `src/domain/week.ts`. Comparison uses the `Date` objects directly.)

After the per-day aggregation, `openOnDate` (if set) marks one specific day as containing an open entry.

`AggregatedDay` gains:

```ts
hasOpenEntry: boolean; // true if any entry contributing to this day had no `end`
```

The flag is purely informational. Totals already include the substituted duration.

**Edge cases:**
- Two open entries on the same day: only one is plausible from Solidtime (one running timer per user), but the loop handles N — each adds to the day's totals and the flag stays true.
- An open entry that spans midnight (started yesterday, still running today): aggregated against its start date, same as Solidtime's own per-entry behaviour. We do not split across days. Acceptable because the existing aggregation also bins by `start`, not by elapsed-day overlap.
- An open entry with `start` in the future: skipped as malformed.

### Render layer — `src/render/summary.ts` only

Only `pige today` consumes the new flag. When the day being rendered has `hasOpenEntry === true`:

- Append a trailing ` …` (single Unicode horizontal ellipsis, U+2026) after the totals figure.
- On a separate dim line below the totals row, render ` (use --fresh to refresh)` exactly once. Dim colour from the existing palette (`muted`).

`render/calendar.ts` and `render/bars.ts` are untouched. Week view (`commands/week.ts`'s render path) does not consult the flag.

### i18n — `src/i18n.ts`

Two new keys, added to both `en` and `fr`:

| Key | en | fr |
|---|---|---|
| `hint.openEntry` | `…` | `…` |
| `hint.useFresh` | `(use --fresh to refresh)` | `(utiliser --fresh pour rafraîchir)` |

(The ellipsis is identical in both locales but routed through `t()` for consistency.)

### Command wiring

Every command that builds `AggregateOptions` (`today.ts`, `week.ts`, `cal.ts`) now passes `now: ctx.now`. No new flags, no new commands.

## Tests

### `tests/domain/aggregate.test.ts` — new cases

1. **Open entry today contributes duration up to `now`.** Given an entry with `start = now - 90 min` and `end = null`, when aggregating with `opts.now`, the day's hours equal 1.5 (within rounding) and `hasOpenEntry === true`.
2. **Open entry whose start lies outside the range is skipped.** `start` is one day before `range.start`, `end = null` → no contribution, `hasOpenEntry` remains false on every day, no throw.
3. **Open entry with a future `start` is skipped.** Defensive case — `start = now + 1h`, `end = null` → skipped.
4. **Closed entries still aggregate normally.** Regression guard — the existing tests already cover this, but one explicit assertion lives next to the new ones for readability.

### `tests/render/summary.test.ts` — new cases

5. **`hasOpenEntry: true` snapshot includes `…` and the hint line.** Strip ANSI, assert both strings present.
6. **`hasOpenEntry: false` snapshot has neither.** Regression guard.

### Fixtures

No new fixture files. Tests construct `TimeEntry[]` inline.

## Docs

`README.md`: add a one-paragraph note in the "Cache" section explaining that when a Solidtime timer is running, `pige today` reflects elapsed time up to the moment of the last fetch, and recommends `--fresh` for sub-5-minute accuracy.

## Risk

- The change to `AggregateOptions` is a breaking signature change for any test or caller that constructs it manually. All in-tree call sites are updated in the same PR; there are no external consumers.
- Including elapsed time in totals means snapshot tests that previously asserted on raw hours could become time-sensitive if a future test forgets to set `opts.now` deterministically. Mitigation: existing tests already inject `ctx.now`; the new field follows the same pattern.

## Out of scope (revisit later)

- Auto-refresh or shorter TTL for open-entry caches.
- Visual cue in week/calendar views.
- Surfacing the running timer's project name or description anywhere.
