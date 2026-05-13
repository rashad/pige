# pige

A small terminal calendar for freelance day tracking, built on top of [Solidtime](https://solidtime.io).

`pige` reads your Solidtime time entries and renders them as a monthly heatmap calendar, a current-week balance against per-client targets, and a quick "today" summary — all in your terminal. The UI is in French (named after the slang for a freelance gig). Install and config work in any locale.

```
  ╭──────────────────────────────────────────────────────────╮
  │  pige · Mai 2026                       13 / 22 jours     │
  ╰──────────────────────────────────────────────────────────╯

       Lun   Mar   Mer   Jeu   Ven   Sam   Dim

                          ▓ 1   ▓ 2   · 3   · 4
       ▓ 5   ▓ 6   ▒ 7   ▓ 8   ▓ 9   ·10   ·11
       ▣12   ▓13   ▓14   ▓15   ▒16   ·17   ·18
       ▓19   ▓20   ▒21   ▓22   ▓23   ·24   ·25
       ▓26   ▓27   ▓28   ▒29   ▒30   ·31

  ── Ce mois ───────────────────────────────────────────────

    ▓ Acme       8.5 j   ████████▌░░░░░░    /15     57 %
    ▒ Globex     6.0 j   ███████▎░░░░░░░    /10     60 %

  ── Semaine en cours (S20) ────────────────────────────────

    ▓ Acme       2.5 / 3.0 j   ████████████░░░░   −0.5
    ▒ Globex     1.5 / 2.0 j   ██████████░░░░░░   −0.5
                 Total semaine : 4.0 j
```

(Real output is 24-bit truecolor cells with Catppuccin-inspired pastels — the blocks above are just an approximation for plain Markdown.)

## Why

You track per-second time in Solidtime, but you bill in days. Solidtime answers *"how many hours per project?"* — `pige` answers *"how many billable days per client this month, and am I balancing my parallel clients correctly this week?"*

## Requirements

- **Node.js ≥ 20** (uses built-in `fetch`)
- A **Solidtime account** with an API token (Solidtime → Settings → API tokens)
- **macOS** recommended for native Keychain token storage; Linux/WSL work via env var or `chmod 0600` file fallback
- A terminal with truecolor support for the nicest output (Ghostty, iTerm2, Warp, Kitty, Alacritty, modern Terminal.app)

## Install

```bash
git clone git@github.com:rashad/pige.git
cd pige
npm install
npm run build
npm link
```

Verify:

```bash
which pige
```

## First run

```bash
pige
```

If no config exists, a wizard runs. It will:

1. Ask for your Solidtime API token (stored in macOS Keychain under service `pige`).
2. Validate against `app.solidtime.io` and pick your organization.
3. Let you map Solidtime **projects → clients** — one client can hold multiple projects.
4. Ask for a color and a weekly day target per client.

Re-run `pige config` any time to edit.

## Usage

Interactive menu (default):

```bash
pige
```

Hotkeys inside the menu: `t` today · `w` week · `c` calendar · `s` sync · `g` configure · `i` status · `q` quit.

Direct subcommands (skip the menu — useful for aliases or scripts):

```bash
pige today                       # today + current-week balance
pige week                        # week breakdown, day by day
pige week --week=20 --year=2026  # a specific ISO week
pige cal                         # monthly heatmap
pige cal --month=2026-04         # a specific month
pige sync                        # force refresh the local cache
pige status                      # token / cache / config health
pige config                      # re-run the wizard
pige --fresh <cmd>               # bypass the cache for this call
```

## Where data lives

| What | Where |
|---|---|
| Config (clients, targets, conversion rule) | `~/.config/pige/config.json` |
| Cached time entries (TTL 5 min, 90-day window) | `~/.config/pige/cache.json` |
| Solidtime API token | macOS Keychain · service `pige`, account `solidtime-token` |

Override the config directory with `PIGE_DIR=…`. Provide the token via `PIGE_SOLIDTIME_TOKEN=…` (useful for CI or non-macOS environments where Keychain is unavailable).

## Conversion rule

`pige` converts hours to days linearly using a configurable `hoursPerDay` (default `7`). Edit it during `pige config` or directly in `config.json`.

## Develop

```bash
npm test            # vitest, 58 tests
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/cli.js
npx tsx src/cli.ts  # dev run without rebuild
```

Architecture is layered and pure-where-possible:

```
src/
  cli.ts                dispatch + arg parsing
  cli/entrySource.ts    cache-aware fetcher
  commands/             menu, today, week, cal, sync, status, config
  domain/               convert, week, holidays, aggregate (pure)
  config/               schema, store, keychain
  cache/                store (TTL + window)
  solidtime/            REST client + types
  render/               palette, box, bars, calendar, summary (pure)
```

The original design and implementation plan live under `docs/superpowers/`.

## Notes

- Public holidays are sourced from [`date-holidays`](https://www.npmjs.com/package/date-holidays) with the `FR` locale. Change `holidaysRegion` in `config.json` for other countries.
- Solidtime API endpoints are based on Solidtime's public REST API. If a self-hosted instance diverges, adjust `src/solidtime/client.ts` and the base URL in `config.json` (`solidtime.baseUrl`).

## License

MIT — see [`LICENSE`](./LICENSE).
