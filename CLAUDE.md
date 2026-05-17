# CLAUDE.md — orientation for agentic workers

This file is the fast on-ramp for any AI agent (or new human contributor) working on `pige`. Read it before touching code; it captures the conventions that aren't obvious from the file tree.

## What `pige` is

A Node.js/TypeScript terminal CLI that reads time entries from [Solidtime](https://solidtime.io), aggregates hours into billable days (linear conversion, configurable `hoursPerDay`), and renders a truecolor monthly heatmap calendar plus daily/weekly summaries. It never writes back to Solidtime — read-only client. See `docs/superpowers/specs/2026-05-13-pige-design.md` for the full design.

## Tech stack

- Node.js ≥ 20 (native `fetch`, top-level `await`), TypeScript strict + `noUncheckedIndexedAccess`, ESM only.
- `tsup` (bundle), `tsx` (dev), `vitest` (test), `biome` (lint + format + organise imports).
- Runtime deps: `chalk`, `@inquirer/prompts`, `date-holidays`, `@napi-rs/keyring`. **No `keytar`** — it's archived; we migrated to `@napi-rs/keyring`.

## Repo layout

```
src/
├── cli.ts                       entry: routes subcommands, top-level catch
├── cli/entrySource.ts           cache-first fetcher used by all read commands
├── commands/                    orchestrators (config → cache → fetch → aggregate → render)
│   ├── menu.ts                  interactive expand-prompt menu with hotkeys
│   ├── today.ts week.ts cal.ts
│   ├── sync.ts status.ts config.ts
│   └── context.ts               shared command context (cfg, clients, now)
├── config/
│   ├── schema.ts                types + defaultConfig
│   ├── store.ts                 ~/.config/pige/config.json (override: PIGE_DIR)
│   └── keychain.ts              token: keychain → env → 0600 file (fallback chain)
├── solidtime/
│   ├── client.ts                createAuthClient + createOrgClient, retry once on 5xx
│   └── types.ts
├── domain/                      PURE: aggregate, convert h→d, holidays (FR), week math
├── render/                      PURE: model → ANSI string (palette, bars, calendar, summary, box)
└── i18n.ts                      createT(locale), MONTHS, WEEKDAYS, normalizeLocale
tests/                            mirrors src/ layout
```

**Layer rules** (do not break these):
- `render/*` is pure. No I/O, no imports from `solidtime/`, `config/`, or `cli/`. This is what makes snapshot tests trivial.
- `domain/*` is pure. Takes data structures, returns data structures. No rendering.
- `solidtime/*` is the only layer that speaks HTTP.
- `commands/*` orchestrates. Pulls from `cli/entrySource.ts` (which handles cache + fetch fallback), never calls `solidtime/*` directly for read paths.

## Common commands

```bash
npm run dev -- <subcommand>   # tsx src/cli.ts <args>  (fast iteration, no build)
npm test                      # vitest run
npm run test:watch            # vitest in watch mode
npm run typecheck             # tsc --noEmit
npm run check                 # biome check (lint + format + imports, read-only)
npm run check:fix             # biome check --write (apply fixes)
npm run build                 # tsup → dist/cli.js
npm run verify                # check + typecheck + test + build (full CI gate, one command)
npm run reload                # build + npm link (re-link after local changes)
npm run link:local            # build + npm link → `pige` on PATH for manual testing
```

CI runs `check → typecheck → test → build` in that order. Run `npm run verify` locally before pushing to match that exactly.

## Conventions

### i18n
- Every user-visible string goes through `t("key")` from `createT(locale)`. Dictionaries live in `src/i18n.ts` as flat string-keyed objects (`en`, `fr`).
- Interpolation: `{name}` placeholders, resolved in the `t()` function.
- New string? Add the key to **both** `en` and `fr`. The day-suffix bug (`j` leaking into English) happened because the FR suffix was hard-coded; `t("unit.day")` fixed it.
- Default locale for new installs is `en`; `fr` is opt-in via the wizard. `normalizeLocale()` accepts `en`, `en-US`, `fr-FR`, etc. and collapses to `en`/`fr`.

### Token storage (read this before touching `config/keychain.ts`)
Lookup order: env var `PIGE_SOLIDTIME_TOKEN` → macOS Keychain (`@napi-rs/keyring`, service `pige`, account `solidtime-token`) → `~/.config/pige/token` with `chmod 0600`.

The keychain library is **sync** and we wrap calls in `async` boundaries. Never log the token. Never include it in error messages — `client.ts` sanitises explicitly.

### Cache window
`cli/entrySource.ts` and `commands/sync.ts` **must use the same window**: `[now - 60d, now + 30d]`. If you change one, change the other or `pige cal` will refetch after every `sync` (we already shipped this bug once).

TTL is 5 minutes. `--fresh` bypasses. If a fetch fails and any cache exists (even expired), fall back with an offline warning.

### Solidtime client
- `createAuthClient(token)` — no org needed; used by `/me` lookup during bootstrap.
- `createOrgClient(token, orgId)` — everything else.
- Transport retries **once** on 5xx with 500ms backoff. **Never** retries 4xx. The wizard relies on this.
- Date params: ISO datetime, **not** `YYYY-MM-DD`. Solidtime returns 422 if you pass bare dates. We append `T00:00:00Z` / `T23:59:59Z`.

### Tests
- `vitest` with `globals: false` — always import `describe`, `it`, `expect`.
- Pure-module tests live next to no fixtures. Render tests strip ANSI via `tests/helpers/stripAnsi.ts` (uses `// biome-ignore lint/suspicious/noControlCharactersInRegex` — don't remove that comment).
- For `cli/entrySource.test.ts`: `isFresh()` uses real `Date.now()`. If you inject a future `ctx.now`, compute `cache.fetchedAt` from real `Date.now()` so the cache isn't seen as future-stale. This bit me once.
- `noUncheckedIndexedAccess` is on. Tests sometimes need `!` non-null assertions after indexed access.

### Wizard
- `commands/config.ts` is **idempotent**. Pre-populates from existing config so the user can Enter through every prompt to keep state. The "add another client?" default is **No** when clients exist.
- Errors throw typed errors; `cli.ts`'s top-level catch prints `❌ <message>` and exits 1. Never call `process.exit` inside command code.

### Menu
- `src/commands/menu.ts` uses `@inquirer/prompts`' `expand` prompt with `expanded: true`. **Not** `select` — `select` doesn't support letter hotkeys, which broke before and would break again.

## Release flow

1. Bump `version` in `package.json`.
2. In `CHANGELOG.md`: rename `## [Unreleased]` to `## [X.Y.Z] — YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, update link refs at the bottom.
3. `git commit -m "chore(release): vX.Y.Z"` then `git tag vX.Y.Z` then `git push && git push origin vX.Y.Z`.
4. `.github/workflows/release.yml` fires on the tag, runs the full CI gate, extracts notes from CHANGELOG via awk, and creates the GH release. No manual steps after the push.

CHANGELOG section parsing in the workflow stops at the next `## [` heading **or** the first `[name]:` link reference. If you change CHANGELOG structure, update the awk in `release.yml`.

## Things not to do

- Don't add `keytar` back. It's archived since 2022 and forces `node-gyp` on every install.
- Don't publish to npm without asking — `pige` is taken and we deliberately skipped publication.
- Don't bypass `cli/entrySource.ts` from a read command. The cache fallback is what makes the tool usable offline.
- Don't add a colour outside the symbolic palette in `render/palette.ts`. Add it to the palette first; configs reference colours by key.
- Don't introduce a global config singleton. Pass `ctx` through (see `commands/context.ts`).
- Don't reformat with prettier or eslint — `biome check` is the single source of truth. Settings in `biome.json` (2-space, double quotes, semicolons, trailing commas, line width 110).
- Don't commit `~/.config/pige/` paths or tokens to test fixtures.

## Quick-start checklist for a new agent

1. `npm install`
2. `npm test` — confirms the toolchain is sane.
3. Read `src/cli.ts` end-to-end (it's short) to see the routing.
4. Pick one command (e.g. `src/commands/today.ts`) and trace it through `cli/entrySource.ts` → `domain/aggregate.ts` → `render/summary.ts`. Once you've seen that path, everything else is the same shape.
5. Glance at `tests/render/calendar.test.ts` to see how snapshot/ANSI testing works here.
