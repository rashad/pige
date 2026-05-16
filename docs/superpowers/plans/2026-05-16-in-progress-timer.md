# In-Progress Timer Inclusion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include any open Solidtime timer in `pige today` by substituting `now` for its missing `end`, mark the absorbing day, and show a `…` + `--fresh` hint in today's output only.

**Architecture:** One pure change in `domain/aggregate.ts` (`AggregateOptions.now`, substitute end, set `hasOpenEntry` flag). One render change in `commands/today.ts` (append `…`, print hint). Two new i18n keys. All view callers thread `now: ctx.now` through `AggregateOptions`.

**Tech Stack:** Node.js ≥ 20, TypeScript strict, ESM, vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-16-in-progress-timer-design.md`

---

### Task 1: Add `now` to `AggregateOptions` and thread through every caller (signature-only)

This task lands the type change and the caller updates with **no behavioural change yet** — the body still drops `end == null` entries. This makes the larger Task 2 a pure logic change with a clean diff.

**Files:**
- Modify: `src/domain/aggregate.ts:21-24` (add `now: Date` to `AggregateOptions`)
- Modify: `src/commands/today.ts:18-21` (pass `now: ctx.now`)
- Modify: `src/commands/today.ts` (pass `now: ctx.now` to the second `aggregateEntries` call if any — there isn't currently, only one)
- Modify: `src/commands/week.ts:14-17` (pass `now: ctx.now`)
- Modify: `src/commands/cal.ts:14-17` and `src/commands/cal.ts:29-32` (pass `now: ctx.now` to both `aggregateEntries` calls)
- Modify: `tests/domain/aggregate.test.ts` (every `aggregateEntries(...)` call gains `now: <something deterministic>` in opts)

- [ ] **Step 1: Add `now` to the type and assert every caller breaks**

Edit `src/domain/aggregate.ts:21-25`:

```ts
export type AggregateOptions = {
  hoursPerDay: number;
  holidaysRegion: string;
  now: Date;
};
```

- [ ] **Step 2: Run typecheck to enumerate broken call sites**

Run: `npm run typecheck`
Expected: FAIL — TS2741 (missing property `now`) on the call sites in `today.ts`, `week.ts`, `cal.ts` (x2), and every `aggregateEntries(...)` invocation in `tests/`.

- [ ] **Step 3: Update `src/commands/today.ts:18-21`**

```ts
const days = aggregateEntries(entries, week, ctx.config.clients, {
  hoursPerDay: ctx.config.conversion.hoursPerDay,
  holidaysRegion: ctx.config.holidaysRegion,
  now: ctx.now,
});
```

- [ ] **Step 4: Update `src/commands/week.ts:14-17` the same way**

```ts
const days = aggregateEntries(entries, range, ctx.config.clients, {
  hoursPerDay: ctx.config.conversion.hoursPerDay,
  holidaysRegion: ctx.config.holidaysRegion,
  now: ctx.now,
});
```

- [ ] **Step 5: Update both `aggregateEntries` calls in `src/commands/cal.ts`**

Lines 14-17 and 29-32. Add `now: ctx.now,` after `holidaysRegion`. Both calls use the same opts object — be careful to add it to both, not just the first.

- [ ] **Step 6: Update every `aggregateEntries(...)` call in `tests/domain/aggregate.test.ts`**

In every existing test inside `describe("aggregateEntries", ...)`, the opts block becomes:

```ts
{ hoursPerDay: 7, holidaysRegion: "FR", now: new Date("2026-05-13T12:00:00Z") }
```

The exact `now` value doesn't matter for these pre-existing tests because they all use closed entries — the field is only consulted for open entries. A constant `now` keeps the diff minimal.

- [ ] **Step 7: Run typecheck and tests; nothing should fail**

Run: `npm run typecheck && npm test`
Expected: PASS. No behavioural change yet.

- [ ] **Step 8: Commit**

```bash
git add src/domain/aggregate.ts src/commands/today.ts src/commands/week.ts src/commands/cal.ts tests/domain/aggregate.test.ts
git commit -m "refactor(aggregate): thread ctx.now through AggregateOptions

No behavioural change — preparing the signature for in-progress entry
substitution in the next commit."
```

---

### Task 2: Add `hasOpenEntry` to `AggregatedDay` and substitute `now` for missing `end`

**Files:**
- Modify: `src/domain/aggregate.ts:9-19` (add `hasOpenEntry: boolean` to `AggregatedDay`)
- Modify: `src/domain/aggregate.ts:38-49` (rewrite the entry loop)
- Modify: `src/domain/aggregate.ts:74-84` (include `hasOpenEntry` in the returned per-day record)
- Test: `tests/domain/aggregate.test.ts` (new cases)

- [ ] **Step 1: Write failing test — open entry today contributes elapsed time**

Add to `tests/domain/aggregate.test.ts` inside the `describe("aggregateEntries", ...)`:

```ts
it("open entry: substitutes now for missing end and flags the day", () => {
  const now = new Date("2026-05-13T09:30:00Z"); // Wed
  const open: TimeEntry = {
    id: "open1",
    start: "2026-05-13T08:00:00Z",
    end: null,
    duration: null,
    projectId: "p1",
    description: "",
    billable: true,
  };
  const out = aggregateEntries([open], range, clients, {
    hoursPerDay: 7,
    holidaysRegion: "FR",
    now,
  });
  const wed = out.find((d) => d.date === "2026-05-13")!;
  // 1.5 hours elapsed / 7 hours per day = ~0.214 days
  expect(wed.perClient.get("acme")).toBeCloseTo(1.5 / 7, 4);
  expect(wed.hasOpenEntry).toBe(true);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/domain/aggregate.test.ts -t "open entry"`
Expected: FAIL (either property doesn't exist or value is 0 because the entry is dropped).

- [ ] **Step 3: Add `hasOpenEntry` to the type**

Edit `src/domain/aggregate.ts:9-19`:

```ts
export type AggregatedDay = {
  date: string;
  weekday: number; // 0 = Mon
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  perClient: Map<ClientId | typeof OTHERS_ID, number>;
  totalDays: number;
  dominantClient?: ClientId | typeof OTHERS_ID;
  isMixed: boolean;
  hasOpenEntry: boolean;
};
```

- [ ] **Step 4: Track open days in the entry loop**

Replace the body of the loop in `src/domain/aggregate.ts` (lines ~37-49) with:

```ts
const byDay = new Map<string, Map<string, number>>();
const openDays = new Set<string>();
for (const e of entries) {
  let durationSec = e.duration;
  let isOpen = false;
  if (e.end == null) {
    const start = new Date(e.start);
    // Only substitute when the open entry's start is inside the requested range.
    if (start < range.start || start > range.end) continue;
    durationSec = Math.max(0, Math.floor((opts.now.getTime() - start.getTime()) / 1000));
    isOpen = true;
  }
  if (durationSec == null) continue;
  const date = formatISODate(new Date(e.start));
  const hours = secondsToHours(durationSec);
  const clientId = projectToClient.get(e.projectId) ?? OTHERS_ID;
  let row = byDay.get(date);
  if (!row) {
    row = new Map();
    byDay.set(date, row);
  }
  row.set(clientId, (row.get(clientId) ?? 0) + hours);
  if (isOpen) openDays.add(date);
}
```

- [ ] **Step 5: Include `hasOpenEntry` in the returned per-day record**

In the same file, find the return inside the `.map((d) => { ... })` block (`src/domain/aggregate.ts:74-84`). Add a line before the closing brace of the returned object:

```ts
return {
  date,
  weekday,
  isWeekend: isWeekend(d),
  isHoliday: isHoliday(d, opts.holidaysRegion),
  holidayName: holidayName(d, opts.holidaysRegion),
  perClient,
  totalDays: total,
  dominantClient: dominant,
  isMixed: nonZero >= 2,
  hasOpenEntry: openDays.has(date),
};
```

- [ ] **Step 6: Run the new test**

Run: `npx vitest run tests/domain/aggregate.test.ts -t "open entry"`
Expected: PASS.

- [ ] **Step 7: Add the remaining open-entry test cases**

Append to `tests/domain/aggregate.test.ts`:

```ts
it("open entry: start outside range is skipped", () => {
  const now = new Date("2026-05-13T09:30:00Z");
  const open: TimeEntry = {
    id: "open2",
    start: "2026-05-09T10:00:00Z", // before range.start (May 11)
    end: null,
    duration: null,
    projectId: "p1",
    description: "",
    billable: true,
  };
  const out = aggregateEntries([open], range, clients, {
    hoursPerDay: 7,
    holidaysRegion: "FR",
    now,
  });
  for (const d of out) {
    expect(d.hasOpenEntry).toBe(false);
    expect(d.totalDays).toBe(0);
  }
});

it("open entry: start in the future is skipped", () => {
  const now = new Date("2026-05-13T09:30:00Z");
  const open: TimeEntry = {
    id: "open3",
    start: "2026-05-19T10:00:00Z", // after range.end (May 17)
    end: null,
    duration: null,
    projectId: "p1",
    description: "",
    billable: true,
  };
  const out = aggregateEntries([open], range, clients, {
    hoursPerDay: 7,
    holidaysRegion: "FR",
    now,
  });
  for (const d of out) {
    expect(d.hasOpenEntry).toBe(false);
    expect(d.totalDays).toBe(0);
  }
});
```

- [ ] **Step 8: Update the existing "running entry (end null) is ignored" test**

That test now asserts the OPPOSITE of the new behaviour — it expects in-range open entries to be dropped. Either rename and repurpose it as a regression for the out-of-range case (which we already cover) or delete it. Recommended: delete it (lines 80-92 in the current file). The new tests cover open-entry behaviour comprehensively.

- [ ] **Step 9: Run the full test file**

Run: `npx vitest run tests/domain/aggregate.test.ts`
Expected: PASS, including all previously-existing closed-entry tests.

- [ ] **Step 10: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/domain/aggregate.ts tests/domain/aggregate.test.ts
git commit -m "feat(aggregate): include in-progress timer entries via now substitution

Open entries (end: null) whose start lies inside the range now
contribute (now - start) seconds and set hasOpenEntry on the day they
landed on. Out-of-range and future starts are skipped. Closed-entry
behaviour is unchanged."
```

---

### Task 3: Add i18n keys for the `…` and `--fresh` hint

**Files:**
- Modify: `src/i18n.ts` (add two keys in both `fr` and `en`)

- [ ] **Step 1: Add keys to the `fr` dictionary**

In `src/i18n.ts`, locate the `// today` block in `fr` (around lines 18-22). Add two lines:

```ts
  "today.openEntry": "…",
  "today.useFresh": "(utiliser --fresh pour rafraîchir)",
```

- [ ] **Step 2: Add the same keys to the `en` dictionary**

Locate the `// today` block in `en` (around lines 98-102). Add:

```ts
  "today.openEntry": "…",
  "today.useFresh": "(use --fresh to refresh)",
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (The `en` type derives from `keyof typeof fr`, so adding to `fr` first and `en` second keeps types consistent throughout the edit.)

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "i18n: add today.openEntry and today.useFresh keys"
```

---

### Task 4: Render `…` and `--fresh` hint in `pige today` when an open entry is present

**Files:**
- Modify: `src/commands/today.ts:29-39`
- Test: `tests/commands/today.test.ts`

- [ ] **Step 1: Write failing test — open entry shows `…` and the hint**

Append to `tests/commands/today.test.ts` (after the existing test, before the closing `});`):

```ts
  it("shows … and the use-fresh hint when today has an open entry", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    const now = new Date(2026, 4, 13, 11, 0, 0); // Wed 11:00 local
    await runToday(
      { config: cfg, now, fresh: false, locale: "fr", t: createT("fr") },
      {
        fetchEntries: async () => [
          {
            id: "open",
            start: new Date(2026, 4, 13, 9, 30, 0).toISOString(), // started 90 min ago
            end: null,
            duration: null,
            projectId: "p1",
            description: "",
            billable: true,
          },
        ],
      },
    );
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("…");
    expect(out).toContain("--fresh");
  });
```

Imports needed at the top of the file (verify they're present — `runToday`, `createT`, `stripAnsi`, `vi`, etc.).

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/commands/today.test.ts -t "open entry"`
Expected: FAIL — the substring `…` is not in the output.

- [ ] **Step 3: Update `src/commands/today.ts` to render the marker**

Replace the existing `if (todayAgg && todayAgg.totalDays > 0) { ... } else { ... }` block (lines 29-39) with:

```ts
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
```

- [ ] **Step 4: Run the new test**

Run: `npx vitest run tests/commands/today.test.ts -t "open entry"`
Expected: PASS.

- [ ] **Step 5: Run the full today test file (regression on the no-open-entry case)**

Run: `npx vitest run tests/commands/today.test.ts`
Expected: PASS — the existing test (closed entries only) must still pass and its output must NOT contain `…` or `--fresh`. Add this defensive assertion to the existing test if not present:

```ts
expect(out).not.toContain("…");
expect(out).not.toContain("--fresh");
```

If you add those assertions, re-run the file.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/today.ts tests/commands/today.test.ts
git commit -m "feat(today): mark open-timer days with … and a --fresh hint"
```

---

### Task 5: Document the open-timer/`--fresh` interaction in README

**Files:**
- Modify: `README.md` (add a paragraph in the section that covers caching, or create one if absent)

- [ ] **Step 1: Locate the cache section in `README.md`**

Run: `grep -n -i "cache\|fresh\|TTL" README.md`
Expected: Some matches. Open the file and find the most relevant subsection (likely under a "How it works" or "Usage" heading). If there is no cache section, add one near the end before any contributor/license sections.

- [ ] **Step 2: Add the paragraph**

Add this paragraph (English; the README is English):

```markdown
### Running timers

If you have a Solidtime timer running, `pige today` includes its elapsed
time up to the moment of the last fetch and marks the day with `…`. The
fetch cache is 5 minutes long, so the displayed total can lag by a few
minutes — use `pige today --fresh` for an up-to-the-second figure.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): note --fresh for running timers"
```

---

### Task 6: Verify end-to-end + check style/build

- [ ] **Step 1: Run the full CI gate locally**

Run: `npm run check && npm run typecheck && npm test && npm run build`
Expected: All four steps PASS.

- [ ] **Step 2: Hand test against a live Solidtime session (optional but recommended)**

Start a timer in Solidtime. Then:

```bash
npm run dev -- today --fresh
```

Expected: today's total includes some non-zero contribution from the open entry, a trailing `…` after the total, and a line `(use --fresh to refresh)` below it. Stop the timer in Solidtime, re-run with `--fresh`, and the `…` disappears.

- [ ] **Step 3: If the hand test passes, no further commit is needed; the work is complete.**

If the hand test reveals a behaviour gap (e.g. `e.end` is `undefined` rather than `null` and our `== null` check misses it — it shouldn't, but verify), fix it in `src/domain/aggregate.ts` and add a test that pins the new case down. Loose-equality `e.end == null` already covers both, so this should not happen.

---

## Done when

- All five spec test cases pass.
- `pige today` against a closed-only fixture produces no `…` or `--fresh` text.
- `pige today` against an open-entry fixture produces both.
- `pige week` and `pige cal` are unchanged in output for closed-only fixtures (no UI regression).
- README has a paragraph explaining the open-timer/`--fresh` interaction.
- `npm run check && npm run typecheck && npm test && npm run build` is green.
