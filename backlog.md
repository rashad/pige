# Backlog

Loose roadmap of things to look at next. Order is not commitment; each item needs a real think-through before implementation.

## 1. Invoice feature

A way to turn "billable days for client X in period Y" into something invoice-ready. Worth digging deeper before scoping.

Open questions to settle:
- What's the output? Plain text block for copy-paste, a PDF, a CSV, or all three?
- Does it need a per-client TJM (daily rate) in config? If so, where is it stored — encrypted? Plain in `config.json`?
- Period selection: month, custom range, fiscal quarter?
- Does it need an invoice number / sequence counter, or is `pige` just feeding numbers into another tool?

## 2. Target days per month

Add `targetDaysPerMonth` alongside `targetDaysPerWeek` per client. Useful for contracts billed monthly rather than weekly.

Notes:
- Decide which one is primary in the config (and whether the other is derived).
- The week view and month view should each pick the right target for their context.
- Backwards compatibility: existing configs only have weekly — derive the monthly value or prompt during the next wizard run.

## 3. Shell completion

`pige completion zsh|bash|fish`. Inquirer-based CLIs don't get this for free, and tab-completing `pige <TAB>` to the command list would be a real ergonomic win.

Notes:
- Approach: emit a static completion script per shell, no runtime dependency.
- Should complete: subcommands, `--fresh`, `--help`, `--month=` patterns, `--week=` / `--year=` patterns.
- Installation guidance in the README (per-shell snippet).

## 4. UX

General pass on the interactive experience — the wizard, the menu, error messages, empty states. No fixed scope yet, just a session of "use pige fresh for a week and write down everything that feels rough."

Candidates to investigate:
- Ctrl-C in the menu currently prints an ugly traceback.
- Wizard re-runs don't make it obvious that pressing Enter keeps the existing value.
- `pige status` doesn't actually verify the token against Solidtime — just that one exists.
- Empty-state on a brand-new account (no entries yet) — does it render cleanly?
- Calendar navigation: only `--month=YYYY-MM`, no `prev`/`next` arrows in the interactive view.

## 5. Public holidays

The current implementation uses `date-holidays` and assumes `FR`. It works but isn't where it should be.

Things to reconsider:
- The library pulls in a lot for what we actually use; a hand-rolled FR table might be lighter.
- Hard-coded region (`FR`) in the config — should this surface in the wizard?
- Some holidays are "if it falls on Sunday, observe Monday" — does the current logic handle that the way the user expects?
- Should regional variants matter (Alsace-Moselle has extra holidays)?

## 7. In-progress timer inclusion

Solidtime entries for a running timer have no `end` time yet — they're omitted from the current aggregation, so `pige today` (and the calendar/week views) under-report hours whenever a session is active. The fix is to detect open-ended entries and substitute `now` as their end time before aggregating.

Open questions to settle:
- Where does the substitution happen? Ideally in `domain/aggregate.ts` so all views benefit without changing each command.
- The API may return running entries with `end: null` or omit the field entirely — confirm the Solidtime response shape and handle both.
- Should a visual cue flag "includes an in-progress session" in the output (e.g. a trailing `…` on today's bar)?
- Cache behaviour: an in-progress entry changes every minute, so the 5-minute TTL means the display can lag. Acceptable trade-off, or should `--fresh` be recommended in the docs for active sessions?

## 6. Billable time

Solidtime entries already carry a `billable` boolean. We currently aggregate everything regardless. For users who flag billable vs internal time, surfacing this distinction in the terminal would be valuable.

Open design:
- Hide non-billable from the calendar but keep it in week/month totals? Or vice versa?
- A toggle per command (`--billable-only`) vs a config-level default?
- Visual distinction: dim cells, hatched pattern, separate row in the summary?
- Per-client breakdown: does "Acme 12.5 d" mean billable-only or total? Needs an explicit decision.
