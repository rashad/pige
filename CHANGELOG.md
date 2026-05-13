# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions CI: typecheck + lint + tests + build on every push to `main` and on PRs.
- Dependabot config: weekly npm updates (grouped by prod/dev) + monthly GitHub Actions updates.
- Biome (lint + format + import organisation), with `lint`, `format`, `check`, `check:fix` npm scripts.
- New `unit.day` i18n key — day suffix is now translated (`j` in French, `d` in English).
- Solidtime client transport now retries once on 5xx (with 500ms backoff); never retries 4xx.
- Tests for `cli/entrySource.ts` covering cache hit, stale refetch, offline fallback, and `--fresh` bypass.
- `package.json` metadata: `repository`, `homepage`, `bugs`, `author`, `keywords`, `files`, plus a `prepare` script so `git clone && npm install` produces a runnable binary.
- `SECURITY.md` with a private vulnerability-reporting channel.

### Changed

- **Breaking (internal API).** `createSolidtimeClient` split into `createAuthClient` (no org id) and `createOrgClient` (org-scoped). Callers updated; the wizard no longer needs a `"PLACEHOLDER"` org id when bootstrapping.
- `pige sync` now fetches the same `[-60d, +30d]` window as the entrySource expects, so a subsequent `pige cal` / `pige today` actually hits the cache instead of refetching.
- Replaced `keytar` (archived since 2022) with `@napi-rs/keyring` (actively maintained, pure-Rust, prebuilt binaries, no `node-gyp`). Same OS-level keychain entry — no token migration needed.
- Config wizard throws typed errors instead of calling `process.exit(1)`; the top-level catch in `cli.ts` handles exit code and the `❌` prefix consistently.
- Consolidated `errors.tokenAbsent` / `errors.tokenAbsentPrefixed` into a single key; the call-site that prints adds the prefix inline.

### Fixed

- Day-unit suffix (`j`) no longer leaks into English output; uses `t("unit.day")` everywhere.

## [0.1.0] — 2026-05-13

### Added

- Initial release. Terminal CLI on top of [Solidtime](https://solidtime.io).
- **Commands**: interactive menu (`pige`), `today`, `week`, `cal`, `sync`, `status`, `config`. Direct subcommands accept `--fresh` to bypass cache, `--month=YYYY-MM` on `cal`, `--week=N --year=YYYY` on `week`.
- **Interactive menu** with single-letter hotkeys (`t`/`w`/`c`/`s`/`g`/`i`/`q`).
- **Monthly heatmap calendar** with truecolor cells (Catppuccin-inspired pastels), French public holidays via `date-holidays`, and weekly/monthly client breakdowns.
- **Bilingual UI** — English (default for new installs) and French. Stored in `config.locale`; auto-detected from `$LANG` at first run; switchable via the wizard.
- **Token storage** in macOS Keychain (service `pige`), with env var and 0600-file fallbacks. Override via `PIGE_SOLIDTIME_TOKEN`.
- **Cache**: 5-minute TTL on a 90-day rolling window at `~/.config/pige/cache.json`. Override the config directory via `PIGE_DIR`.
- **Conversion rule**: hours → days linearly, configurable `hoursPerDay` (default 7).
- **Configuration wizard** that pre-populates from existing config — pressing Enter through every prompt keeps the current setup.
- MIT licensed.

[Unreleased]: https://github.com/rashad/pige/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rashad/pige/releases/tag/v0.1.0
