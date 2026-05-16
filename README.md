# pige

[![ci](https://github.com/rashad/pige/actions/workflows/ci.yml/badge.svg)](https://github.com/rashad/pige/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A small terminal calendar for freelance day tracking, built on top of [Solidtime](https://solidtime.io).

`pige` reads your Solidtime time entries and renders them as a monthly heatmap calendar, a current-week balance against per-client targets, and a quick "today" summary — all in your terminal. Bilingual UI (English or French — you pick during config; default is English). The name comes from French slang for a freelance gig.

```
  ╭──────────────────────────────────────────────────────────╮
  │  pige · May 2026                       13 / 22 days      │
  ╰──────────────────────────────────────────────────────────╯

       Mon   Tue   Wed   Thu   Fri   Sat   Sun

                          ▓ 1   ▓ 2   · 3   · 4
       ▓ 5   ▓ 6   ▒ 7   ▓ 8   ▓ 9   ·10   ·11
       ▣12   ▓13   ▓14   ▓15   ▒16   ·17   ·18
       ▓19   ▓20   ▒21   ▓22   ▓23   ·24   ·25
       ▓26   ▓27   ▓28   ▒29   ▒30   ·31

  ── This month ────────────────────────────────────────────

    ▓ Acme       8.5 d   ████████▌░░░░░░    /15     57 %
    ▒ Globex     6.0 d   ███████▎░░░░░░░    /10     60 %

  ── Current week (W20) ────────────────────────────────────

    ▓ Acme       2.5 / 3.0 d   ████████████░░░░   −0.5
    ▒ Globex     1.5 / 2.0 d   ██████████░░░░░░   −0.5
                 Week total: 4.0 d
```

(Real output is 24-bit truecolor cells with Catppuccin-inspired pastels — the blocks above are just an approximation. Example shown in English; switch to French with `pige config`.)

## Why

You track per-second time in Solidtime, but you bill in days. Solidtime answers *"how many hours per project?"* — `pige` answers *"how many billable days per client this month, and how does that compare to my weekly target?"*

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

1. **Pick a language** — English or French. Defaults to your `$LANG` (e.g. `fr_*` → French, anything else → English).
2. Ask for your Solidtime API token (stored in macOS Keychain under service `pige`).
3. Validate against `app.solidtime.io` and pick your organization.
4. Let you map Solidtime **projects → clients** — one client can hold multiple projects.
5. Ask for a color and a weekly day target per client.

Re-run `pige config` any time to edit. Every prompt remembers your current value, so pressing Enter through the wizard keeps everything as-is.

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

### Running timers

If you have a Solidtime timer running, `pige today` includes its elapsed
time up to the moment of the last fetch and marks the day with `…`. The
fetch cache is 5 minutes long, so the displayed total can lag by a few
minutes — use `pige today --fresh` for an up-to-the-second figure.

## Where data lives

| What | Where |
|---|---|
| Config (clients, targets, conversion rule) | `~/.config/pige/config.json` |
| Cached time entries (TTL 5 min, 90-day window) | `~/.config/pige/cache.json` |
| Solidtime API token | macOS Keychain · service `pige`, account `solidtime-token` |

Override the config directory with `PIGE_DIR=…`. Provide the token via `PIGE_SOLIDTIME_TOKEN=…` (useful for CI or non-macOS environments where Keychain is unavailable).

## Conversion rule

`pige` converts hours to days linearly using a configurable `hoursPerDay` (default `7`). Edit it during `pige config` or directly in `config.json`.

## Language

The UI is available in **English** (default for new installs) and **French**. Your pick is stored in `~/.config/pige/config.json` under `locale` (`"en"` or `"fr"`).

- **New installs** auto-detect from `$LANG` / `$LC_ALL` (anything starting with `fr_*` defaults to French, otherwise English) and confirm via the wizard's first prompt.
- **Change later**: re-run `pige config`, pick the other language, then Enter through the rest of the wizard to keep everything else as-is.
- **Independent of holidays**: the `holidaysRegion` field is separate — a French-speaker living abroad can keep `locale: "fr"` with `holidaysRegion: "DE"`, and vice versa.

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
