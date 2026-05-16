# Calendar-Aware Target Derivation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive each client's expected days for any period from one formula — `targetDaysPerWeek × workingDaysIn(period) / 5` — replacing the `× 4.33` hack in `cal.ts` and making the week summary holiday-aware.

**Architecture:** New pure module `src/domain/targets.ts` exporting `workingDaysIn(range, region)` and `targetDaysFor(client, range, region)`. Existing call sites (cal.ts month target, summary.ts week target) switch to the helper. `renderWeekSummary` is widened to accept a `targets: Map` (mirroring `renderMonthSummary`). No schema change.

**Tech Stack:** Node.js ≥ 20, TypeScript strict, vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-16-target-days-derivation-design.md`

---

### Task 1: Add `src/domain/targets.ts` with `workingDaysIn` and `targetDaysFor`

**Files:**
- Create: `src/domain/targets.ts`
- Test: `tests/domain/targets.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/targets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Client } from "../../src/config/schema.js";
import { targetDaysFor, workingDaysIn } from "../../src/domain/targets.js";
import type { DateRange } from "../../src/domain/week.js";

const fullTime: Client = {
  id: "acme",
  solidtimeProjectIds: ["p1"],
  label: "Acme",
  color: "blue",
  targetDaysPerWeek: 5,
};

const partTime: Client = { ...fullTime, id: "globex", label: "Globex", targetDaysPerWeek: 2 };

// May 4-10 2026: Mon-Sun, no FR holidays (Ascension is May 14 2026, Pentecost May 25).
const cleanWeek: DateRange = {
  start: new Date(2026, 4, 4),
  end: new Date(2026, 4, 10, 23, 59, 59, 999),
};

// May 11-17 2026: contains Ascension Thursday May 14 (FR public holiday).
const holidayWeek: DateRange = {
  start: new Date(2026, 4, 11),
  end: new Date(2026, 4, 17, 23, 59, 59, 999),
};

// May 2026 full month
const may2026: DateRange = {
  start: new Date(2026, 4, 1),
  end: new Date(2026, 4, 31, 23, 59, 59, 999),
};

// A single Sunday
const sundayOnly: DateRange = {
  start: new Date(2026, 4, 10),
  end: new Date(2026, 4, 10, 23, 59, 59, 999),
};

describe("workingDaysIn", () => {
  it("counts 5 weekdays in a clean week", () => {
    expect(workingDaysIn(cleanWeek, "FR")).toBe(5);
  });
  it("subtracts FR public holidays", () => {
    expect(workingDaysIn(holidayWeek, "FR")).toBe(4);
  });
  it("excludes weekends only", () => {
    expect(workingDaysIn(sundayOnly, "FR")).toBe(0);
  });
});

describe("targetDaysFor", () => {
  it("full-time on a clean week = 5", () => {
    expect(targetDaysFor(fullTime, cleanWeek, "FR")).toBe(5);
  });
  it("full-time on a holiday week = working-day count", () => {
    expect(targetDaysFor(fullTime, holidayWeek, "FR")).toBe(4);
  });
  it("part-time (2 d/w) on a clean week = 2", () => {
    expect(targetDaysFor(partTime, cleanWeek, "FR")).toBe(2);
  });
  it("part-time (2 d/w) on a holiday week = 1.6", () => {
    expect(targetDaysFor(partTime, holidayWeek, "FR")).toBeCloseTo(1.6, 6);
  });
  it("full-time on a calendar month = working days in the month", () => {
    expect(targetDaysFor(fullTime, may2026, "FR")).toBe(workingDaysIn(may2026, "FR"));
  });
  it("part-time on a calendar month = monthly working days × 2 / 5", () => {
    const wd = workingDaysIn(may2026, "FR");
    expect(targetDaysFor(partTime, may2026, "FR")).toBeCloseTo((wd * 2) / 5, 6);
  });
  it("range entirely inside a weekend = 0", () => {
    expect(targetDaysFor(fullTime, sundayOnly, "FR")).toBe(0);
    expect(targetDaysFor(partTime, sundayOnly, "FR")).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/domain/targets.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/targets.js'`.

- [ ] **Step 3: Implement the module**

Create `src/domain/targets.ts`:

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

export function targetDaysFor(client: Client, range: DateRange, holidaysRegion: string): number {
  const wd = workingDaysIn(range, holidaysRegion);
  return (client.targetDaysPerWeek * wd) / 5;
}
```

- [ ] **Step 4: Run the test file**

Run: `npx vitest run tests/domain/targets.test.ts`
Expected: PASS — all 10 cases green.

- [ ] **Step 5: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/targets.ts tests/domain/targets.test.ts
git commit -m "feat(domain): add targetDaysFor and workingDaysIn helpers

Computes a client's expected days for any DateRange as
targetDaysPerWeek × (working days in range) / 5. Working days exclude
weekends and public holidays for the configured region."
```

---

### Task 2: Switch `cal.ts` from `× 4.33` to `targetDaysFor`

**Files:**
- Modify: `src/commands/cal.ts:23`
- Test: `tests/commands/cal.test.ts`

- [ ] **Step 1: Update the snapshot expectation in the existing `cal.test.ts`**

Open `tests/commands/cal.test.ts`. The existing test asserts the output contains `"Ce mois"`. We need to also assert the monthly target now reflects working days for May 2026. May 2026 has 21 weekdays minus 1 holiday (Ascension, May 14) = 20 working days. With `targetDaysPerWeek = 3`, the monthly target = `3 × 20 / 5 = 12`.

Add this assertion to the existing `it("prints month grid and totals", ...)` after the existing expects:

```ts
expect(out).toContain("/12");
```

Also add a new test that pins the holiday-awareness:

```ts
it("monthly target reflects holidays (not × 4.33)", async () => {
  const logs: string[] = [];
  vi.spyOn(console, "log").mockImplementation((s: string) => {
    logs.push(s);
  });
  await runCal(
    { config: cfg, now: new Date(2026, 4, 13), fresh: false, locale: "fr", t: createT("fr") },
    { fetchEntries: async () => [] },
    { year: 2026, month: 5 },
  );
  const out = stripAnsi(logs.join("\n"));
  // Hard-coded May 2026 working days: 21 weekdays − 1 FR holiday (Ascension) = 20
  // targetDaysPerWeek=3 → 3 × 20 / 5 = 12
  expect(out).toContain("/12");
  // The old × 4.33 formula would have produced 12.99 → "/12.99"
  expect(out).not.toContain("12.99");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/commands/cal.test.ts`
Expected: FAIL — output still contains `/12.99` (from the `× 4.33` formula).

- [ ] **Step 3: Update `src/commands/cal.ts:23`**

Replace:

```ts
const targets = new Map(ctx.config.clients.map((c) => [c.id, c.targetDaysPerWeek * 4.33] as const));
```

with:

```ts
const targets = new Map(
  ctx.config.clients.map(
    (c) => [c.id, targetDaysFor(c, range, ctx.config.holidaysRegion)] as const,
  ),
);
```

Add the import at the top of the file:

```ts
import { targetDaysFor } from "../domain/targets.js";
```

- [ ] **Step 4: Run the test file**

Run: `npx vitest run tests/commands/cal.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/cal.ts tests/commands/cal.test.ts
git commit -m "fix(cal): use calendar-aware targetDaysFor for monthly target

Drops the × 4.33 approximation; monthly target now equals
(targetDaysPerWeek × working-days-in-month / 5), which auto-prorates
around public holidays."
```

---

### Task 3: Widen `renderWeekSummary` to accept a `targets: Map` (mirror `renderMonthSummary`)

**Files:**
- Modify: `src/render/summary.ts:28-54`
- Test: `tests/render/summary.test.ts`

- [ ] **Step 1: Update the existing renderWeekSummary test to pass a targets map**

Replace the `renderWeekSummary` test block at the bottom of `tests/render/summary.test.ts` with:

```ts
describe("renderWeekSummary", () => {
  it("shows delta vs target per client", () => {
    const week = new Map<string, number>([
      ["acme", 2.5],
      ["globex", 1.5],
    ]);
    const targets = new Map<string, number>([
      ["acme", 3],
      ["globex", 2],
    ]);
    const out = stripAnsi(renderWeekSummary(week, targets, clients, 20, t));
    expect(out).toContain("Semaine");
    expect(out).toContain("20");
    expect(out).toContain("2.5");
    expect(out).toContain("3.0");
    expect(out).toMatch(/-0\.5|−0\.5/);
  });

  it("uses the passed-in target, not the client field", () => {
    const week = new Map<string, number>([["acme", 1.6]]);
    // Holiday-aware: 2 d/w on a 4-working-day week → 1.6
    const targets = new Map<string, number>([["acme", 1.6]]);
    const out = stripAnsi(
      renderWeekSummary(week, targets, [{ ...clients[0]!, targetDaysPerWeek: 2 }], 20, t),
    );
    expect(out).toContain("1.6");
    expect(out).toContain("ok"); // delta = 0 → ok
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/render/summary.test.ts`
Expected: FAIL — `renderWeekSummary` signature mismatch (extra argument).

- [ ] **Step 3: Update `renderWeekSummary` signature and body**

In `src/render/summary.ts`, replace the `renderWeekSummary` function (lines 28-54) with:

```ts
export function renderWeekSummary(
  week: Map<string, number>,
  targets: Map<string, number>,
  clients: Client[],
  weekNumber: number,
  t: T,
): string {
  const lines: string[] = [sectionSeparator(t("summary.weekTitle", { week: weekNumber }), WIDTH), ""];
  let total = 0;
  for (const c of clients) {
    const days = week.get(c.id) ?? 0;
    total += days;
    const tgt = targets.get(c.id) ?? 0;
    const bar = progressBar(days, Math.max(tgt, 1), 16, c.color);
    const delta = days - tgt;
    const deltaStr =
      delta === 0
        ? dim(t("summary.ok"))
        : delta < 0
          ? dim(`−${Math.abs(delta).toFixed(1)}`)
          : accent(`+${delta.toFixed(1)}`);
    lines.push(
      `   ${accent(c.label.padEnd(10))} ${days.toFixed(1)} / ${tgt.toFixed(1)} ${t("unit.day")}   ${bar}  ${deltaStr}`,
    );
  }
  lines.push("", `   ${dim(t("summary.weekTotal"))} ${accent(total.toFixed(1))} ${t("unit.day")}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the render test file**

Run: `npx vitest run tests/render/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck now lists every broken caller**

Run: `npm run typecheck`
Expected: FAIL — `renderWeekSummary(...)` calls in `src/commands/today.ts:44`, `src/commands/week.ts:47`, and `src/commands/cal.ts:35` all error on the missing `targets` argument. Good — Task 4 fixes them.

- [ ] **Step 6: Commit (intermediate, type-broken state is acceptable here since the next task closes it within minutes)**

Skip the commit; the typecheck failure is temporary. Move directly to Task 4 and commit at the end of Task 4 together. The next subagent picks up at Task 4 with the file in a broken-typecheck state.

Note for the executor: do not commit at the end of Task 3.

---

### Task 4: Update every `renderWeekSummary` call site to pass `targets`

**Files:**
- Modify: `src/commands/today.ts` (the call at line 44 and surrounding setup)
- Modify: `src/commands/week.ts` (the call at line 47 and surrounding setup)
- Modify: `src/commands/cal.ts` (the call at line 35 and surrounding setup)
- Test: `tests/commands/week.test.ts` (assertion update for holiday-aware target)

- [ ] **Step 1: Update `src/commands/today.ts` — compute weekly targets and pass them**

Replace the tail of `runToday` (around lines 42-44):

```ts
const weekTotals = sumPerClient(days);
const { week: wk } = isoWeekOf(today);
const weekTargets = new Map(
  ctx.config.clients.map((c) => [c.id, targetDaysFor(c, week, ctx.config.holidaysRegion)] as const),
);
console.log(renderWeekSummary(weekTotals, weekTargets, ctx.config.clients, wk, ctx.t));
```

Add the import:

```ts
import { targetDaysFor } from "../domain/targets.js";
```

- [ ] **Step 2: Update `src/commands/week.ts:46-47` the same way**

Replace the tail of `runWeek`:

```ts
const totals = sumPerClient(days);
const weekTargets = new Map(
  ctx.config.clients.map((c) => [c.id, targetDaysFor(c, range, ctx.config.holidaysRegion)] as const),
);
console.log(renderWeekSummary(totals, weekTargets, ctx.config.clients, week, ctx.t));
```

Add the import:

```ts
import { targetDaysFor } from "../domain/targets.js";
```

- [ ] **Step 3: Update `src/commands/cal.ts:35` the same way**

The cal already has `targetDaysFor` imported from Task 2. Replace the `renderWeekSummary` call at line 35:

```ts
const weekTargets = new Map(
  ctx.config.clients.map((c) => [c.id, targetDaysFor(c, wk, ctx.config.holidaysRegion)] as const),
);
console.log(renderWeekSummary(weekTotals, weekTargets, ctx.config.clients, week, ctx.t));
```

- [ ] **Step 4: Run typecheck — should now pass**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Run the full suite — flag any regressions**

Run: `npm test`
Expected: Mostly PASS. `tests/commands/week.test.ts` may need a small assertion tweak — its fixture asks for the week containing May 13 2026, which is the same Ascension week as the holiday-aware test. The existing test only asserts on substrings (`/Lun.*11/`, etc.) that don't include the target, so it should pass without changes. Verify.

If `tests/commands/week.test.ts` fails, the change is likely a rendered-target value (e.g. `3` → `2.4` for `targetDaysPerWeek=3` × 4 working days / 5). Update assertions accordingly.

- [ ] **Step 6: Commit Tasks 3 + 4 together**

```bash
git add src/render/summary.ts src/commands/today.ts src/commands/week.ts src/commands/cal.ts tests/render/summary.test.ts tests/commands/week.test.ts
git commit -m "feat(week): use calendar-aware target in the week summary

renderWeekSummary now takes a targets map (mirroring
renderMonthSummary). Every caller computes the map via targetDaysFor,
so holiday weeks correctly show a reduced expectation."
```

---

### Task 5: Update the config wizard copy to clarify "5 = full-time"

**Files:**
- Modify: `src/i18n.ts` (the `config.target` string in `fr` and `en`)

- [ ] **Step 1: Update the `fr` copy**

In `src/i18n.ts`, line 72:

```ts
"config.target": "Jours par semaine (5 = temps plein) :",
```

- [ ] **Step 2: Update the `en` copy**

In `src/i18n.ts`, line 152:

```ts
"config.target": "Days per week (5 = full-time):",
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS. (No test pins the exact wizard prompt copy; if one does, update its expected string.)

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "i18n(wizard): clarify days-per-week = 5 means full-time"
```

---

### Task 6: Add a README note explaining the model

**Files:**
- Modify: `README.md` (config section)

- [ ] **Step 1: Find the config section**

Run: `grep -n -i "target\|days per week\|configur" README.md`
Expected: Some matches. Open the file and find the most relevant subsection. If there is no dedicated config section, append the note to the closest usage section.

- [ ] **Step 2: Add the paragraph**

```markdown
### Targets

Each client's `targetDaysPerWeek` is the basis for both weekly and
monthly expectations. Set `5` for full-time (you'll be expected every
working day; weekends and public holidays are automatically excluded),
or a smaller number for partial contracts. The monthly target shown by
`pige cal` is `targetDaysPerWeek × (working days in the month) / 5`,
so a holiday in the month reduces the expected total proportionally.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): explain how targetDaysPerWeek drives both views"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the full CI gate locally**

Run: `npm run check && npm run typecheck && npm test && npm run build`
Expected: All four steps PASS.

- [ ] **Step 2: Hand test the holiday-aware behaviour**

```bash
npm run dev -- cal --month=2026-05
```

Expected: For each client, the monthly target is `targetDaysPerWeek × 20 / 5` (May 2026 has 20 working days), not `targetDaysPerWeek × 4.33`. E.g. a `targetDaysPerWeek=3` client shows `/12` not `/12.99`.

```bash
npm run dev -- week --week=20 --year=2026
```

Expected: For week 20 2026 (May 11-17, contains Ascension on Thursday), a `targetDaysPerWeek=3` client shows a target of `2.4`, not `3.0`. A `targetDaysPerWeek=5` (full-time) client shows `4.0`, not `5.0`.

---

## Done when

- All `tests/domain/targets.test.ts` cases pass.
- `tests/commands/cal.test.ts` asserts `/12` for May 2026 and explicitly rejects `12.99`.
- `tests/render/summary.test.ts` exercises the new `targets` parameter on `renderWeekSummary`.
- `cal --month=2026-05` shows holiday-aware monthly targets.
- `week --week=20 --year=2026` shows holiday-aware weekly targets.
- The wizard prompt copy clarifies "5 = full-time".
- README explains the formula in one paragraph.
- `npm run check && npm run typecheck && npm test && npm run build` is green.
