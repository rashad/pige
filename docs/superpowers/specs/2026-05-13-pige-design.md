# pige — Design

**Date:** 2026-05-13
**Status:** Draft, awaiting user review
**Owner:** Rashad

## 1. Context

The user invoices freelance work and tracks time in **Solidtime** (cloud, `app.solidtime.io`), which exposes hours per project. What's missing is a **consolidated monthly calendar view** to see how time is allocated against weekly targets, plus a **fast daily summary** in the terminal.

No new tracker is needed — Solidtime stays the source of truth. `pige` is a read / aggregate / render layer on top of it.

## 2. Goals

- Convert Solidtime hours into **billable days** (linear rule: 7 h = 1 day).
- Render a **monthly terminal calendar** legible at a glance (heatmap, dominant client colour per day).
- Render a **week view** with delta against a per-client `days/week` target.
- Allow purely **interactive** use (menu, nothing to memorise) while still exposing direct subcommands for power users.
- Stay entirely in the terminal (no web surface).

## 3. Non-goals

- No time-entry creation or editing (we never write back to Solidtime).
- No PDF invoice generation.
- No long-term historical analytics (quarterly/yearly aggregates beyond strictly necessary).
- No multi-user support.
- No proactive push/email notifications.

## 4. User journeys

### 4.1 Daily use

```
$ pige
  ╭─ pige ──────────────────────────────────────────╮
  │  What do you want to see?                       │
  │  ❯ Today                    (t)                 │
  │    This week                (w)                 │
  │    Month calendar           (c)                 │
  │    ──────────────                               │
  │    Sync now                 (s)                 │
  │    Configure                (g)                 │
  │    Status                   (i)                 │
  │    Quit                     (q)                 │
  ╰─────────────────────────────────────────────────╯
```

Navigation via arrow keys **or** direct hotkey (letter in parentheses). After a view is shown: `↩ Enter` returns to the menu, `q` quits.

### 4.2 First run

If there is no config:

1. The `pige config` wizard launches automatically.
2. It asks for the Solidtime API token, validates it (one `GET /me` call), and stores it in the macOS Keychain (fallback: `~/.config/pige/config.json` with `chmod 0600` if the keychain library fails).
3. Lists the user's Solidtime projects.
4. For each project to follow: short name, colour (from a fixed palette), days/week target.
5. Confirms and runs an initial `sync`.

### 4.3 Direct subcommands (power user)

| Command            | Behaviour                                                                 |
|--------------------|---------------------------------------------------------------------------|
| `pige`             | Interactive menu (default).                                               |
| `pige today`       | Today's summary + current week.                                           |
| `pige week`        | Detailed week view (one day per line). `--week 20`, `--year 2026`.        |
| `pige cal`         | Monthly heatmap calendar. `--month 2026-04`.                              |
| `pige sync`        | Force a full fetch, rewrite the cache.                                    |
| `pige config`      | (Re)configuration wizard. Idempotent.                                     |
| `pige status`      | Token OK, last sync, version, config path.                                |
| `--fresh`          | Global flag: bypass the cache for this command.                           |

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  cli.ts (entry point, routing)                           │
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  commands/ : menu, today, week, cal, sync, config, status│
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  domain/ : aggregate, convert, holidays, week            │
│  ↑                                                       │
│  cache/ : store (read/write JSON, TTL)                   │
│  ↑                                                       │
│  solidtime/ : client (fetch entries, projects)           │
│  ↑                                                       │
│  config/ : store, schema, keychain                       │
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  render/ : palette, bars, calendar, summary, box         │
│  (pure: takes an aggregated model → returns an ANSI str) │
└──────────────────────────────────────────────────────────┘
```

**Principles:**
- `render/*` is fully pure: takes a data model in, returns a string. No dependency on `solidtime/*` or `config/*`. Enables snapshot tests without network.
- `domain/*` knows nothing about rendering. Outputs normalised structures.
- `solidtime/*` is the only layer that speaks HTTP.
- `commands/*` orchestrates: config → cache → fetch → aggregate → render → print.

### 5.1 Target tree

```
pige/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts
│   ├── config/
│   │   ├── schema.ts
│   │   ├── store.ts
│   │   └── keychain.ts
│   ├── solidtime/
│   │   ├── client.ts
│   │   └── types.ts
│   ├── domain/
│   │   ├── aggregate.ts
│   │   ├── convert.ts
│   │   ├── holidays.ts
│   │   └── week.ts
│   ├── cache/
│   │   └── store.ts
│   ├── render/
│   │   ├── palette.ts
│   │   ├── bars.ts
│   │   ├── calendar.ts
│   │   ├── summary.ts
│   │   └── box.ts
│   └── commands/
│       ├── menu.ts
│       ├── today.ts
│       ├── week.ts
│       ├── cal.ts
│       ├── sync.ts
│       ├── config.ts
│       └── status.ts
├── tests/
│   ├── unit/
│   └── snapshots/
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-13-pige-design.md
```

## 6. Tech stack

- **Runtime:** Node.js ≥ 20 (native `fetch`, top-level `await`).
- **Language:** TypeScript (strict).
- **Build:** `tsup` → single ESM bundle with shebang, exposed via the `bin` field in `package.json`.
- **Dev loop:** `tsx src/cli.ts <args>`.
- **Package manager:** `npm` (default; `pnpm` or `bun` also compatible, implementer's choice).
- **Runtime dependencies:**
  - `chalk` (truecolor ANSI)
  - `@inquirer/prompts` (menu, wizard)
  - `date-holidays` (FR holidays, `fr` locale)
  - `@napi-rs/keyring` *or* file fallback (see §10)
- **Tests:** `vitest`.

## 7. Data flow

```
                          ┌──────────────────┐
pige <cmd>     ─────────▶ │  load config     │
                          └────────┬─────────┘
                                   │ no config? → wizard
                                   ▼
                          ┌──────────────────┐
                          │  read cache      │
                          └────────┬─────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
            cache OK                               cache miss
            (< TTL, period covered)                or --fresh
                │                                     │
                │                                     ▼
                │                          ┌──────────────────┐
                │                          │ solidtime.fetch  │
                │                          │ (period)         │
                │                          └────────┬─────────┘
                │                                   │
                │                                   ▼
                │                          ┌──────────────────┐
                │                          │ cache.write      │
                │                          └────────┬─────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  ▼
                          ┌──────────────────┐
                          │ aggregate +      │
                          │ convert h → d    │
                          └────────┬─────────┘
                                   ▼
                          ┌──────────────────┐
                          │ render → stdout  │
                          └──────────────────┘
```

**Aggregated model (output of `domain/aggregate.ts`):**

```ts
type AggregatedDay = {
  date: string;                       // ISO yyyy-mm-dd
  weekday: 0..6;                      // 0 = Monday
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  perClient: Map<ClientId, number>;   // decimal days
  totalDays: number;
  dominantClient?: ClientId;          // null on weekend/holiday/empty
  isMixed: boolean;                   // ≥ 2 clients on this day
};
```

## 8. Cache

- File: `~/.config/pige/cache.json`
- TTL: **5 minutes**. After that, refetch automatically.
- Strategy: cache the **raw Solidtime entries** over a 90-day rolling window, not the aggregates — aggregation is fast and deterministic.
- Schema:
  ```json
  {
    "version": 1,
    "fetchedAt": "2026-05-13T10:22:31Z",
    "windowFrom": "2026-02-13",
    "windowTo": "2026-05-13",
    "entries": [ /* TimeEntry[] */ ]
  }
  ```
- `--fresh` bypasses the cache.
- Offline mode: if a fetch fails **and** a cache exists (even expired), use it with a warning `⚠ Offline mode, data from <timestamp>`.

## 9. Config

`~/.config/pige/config.json`:

```json
{
  "version": 1,
  "solidtime": {
    "baseUrl": "https://app.solidtime.io/api",
    "organizationId": "<uuid>"
  },
  "conversion": {
    "hoursPerDay": 7
  },
  "clients": [
    {
      "id": "acme",
      "solidtimeProjectIds": ["<uuid-1>"],
      "label": "Acme",
      "color": "blue",
      "targetDaysPerWeek": 3.0
    },
    {
      "id": "globex",
      "solidtimeProjectIds": ["<uuid-2>", "<uuid-3>"],
      "label": "Globex",
      "color": "green",
      "targetDaysPerWeek": 2.0
    }
  ],
  "locale": "en",
  "holidaysRegion": "FR"
}
```

- A single client can map to **several** Solidtime projects (useful when a client has sub-projects).
- Unmapped projects fall into an "Other" category (grey, no target).
- `color`: symbolic key (`blue`, `green`, `amber`, `pink`, `cyan`, `purple`) → Catppuccin-like palette resolved in `render/palette.ts`.
- `locale`: `en` (default for new installs) or `fr`. Auto-detected from `$LANG` on first run, overridable through the wizard.

## 10. Security & secrets

- **Solidtime token** stored in the **macOS Keychain** via `@napi-rs/keyring` (service: `pige`, account: `solidtime-token`).
- **Fallback** if the keychain is unavailable (e.g. native dep broken): env var `PIGE_SOLIDTIME_TOKEN`, otherwise file `~/.config/pige/token` with `chmod 0600`. The wizard prints a clear warning in that case.
- No token ever appears in logs or error messages (explicit sanitisation).

## 11. Visual rendering

See the detailed mockup in the design conversation. Principles:

- **Truecolor 24-bit** (per-day coloured background, Catppuccin-like palette).
- Day cell = ` NN ` (3 columns) with the dominant client's background colour.
- Mixed day (≥ 2 clients): background colour of the majority client + a small marker (star / dot) to signal the mix; the breakdown is visible in the week view.
- Weekends and holidays: very discreet grey background + number in light grey.
- Progress bars: fractional Unicode blocks (`▏▎▍▌▋▊▉█`) for smooth rendering.
- Rounded borders `╭ ╮ ╰ ╯`, `──` separators.
- Colour-support detection via `chalk`; without truecolor, fall back to ANSI 256, then 16.
- Target width: 60 columns, degrades cleanly below.

## 12. Errors

| Case                                  | Behaviour                                                                    |
|---------------------------------------|------------------------------------------------------------------------------|
| No config                             | Auto-switch to the `config` wizard.                                          |
| Invalid token (401)                   | Clear message, suggest `pige config`. Exit 1, no stack trace.                |
| Network unavailable                   | Fall back to the cache even if expired, with a visible warning.              |
| Solidtime project deleted             | Displayed as "(archived)" in config/status, excluded from totals.            |
| No entries on the period              | Neutral message, not an error.                                               |
| Keychain permission denied            | Suggest the env var or 0600 file fallback.                                   |
| Terminal without colour support       | Degrade to ANSI 256 or monochrome (readability preserved).                   |
| Terminal width < 60 columns           | Compact layout (legend on 2 lines, totals stacked).                          |

## 13. Tests

- **Unit (vitest)** on every module under `domain/` and `cache/`. Edge cases: 0 h, fractions, 14-hour days, time zones, ISO weeks around new year, moveable Easter.
- **Snapshot tests** on `render/*`: fixture month → captured ANSI → compared. `FORCE_COLOR=3` in CI for stability.
- **HTTP mocks** for `solidtime/client.ts` (`msw` or a `fetch` stub).
- No E2E tests — the cli → render combo via snapshots covers the essentials.

## 14. Open questions / Future work

- **Quarterly/yearly view** (cumulative per client) — not in v1; revisit if the need confirms itself after a few months of usage.
- **CSV export** of billable days by client/month (useful for the accountant) — consider after v1.
- **npm publication** vs purely local use via `npm link` — left to implementation (default: local, no publish).
- **Cron / launchd** to sync the cache in the background — out of scope for v1; the user syncs on demand.
- **Multi-organisation Solidtime**: v1 assumes a single `organizationId`; broaden if needed.
