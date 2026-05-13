# Security policy

`pige` stores a Solidtime API token on your machine (macOS Keychain by default, with env-var and 0600-file fallbacks). If you find a vulnerability — for example in how the token is stored, transmitted, or in any HTTP boundary against Solidtime — please report it **privately** rather than opening a public issue.

## How to report

- **Preferred:** open a [private security advisory on GitHub](https://github.com/rashad/pige/security/advisories/new). This keeps the report invisible to the public until it's resolved and lets us collaborate on the fix in a private fork.
- **Alternative:** email **rashad.karanouh@gmail.com** with the details. Encrypt with my public key if you have one; otherwise plain text is fine.

Please include:

- A clear description of the issue and its impact.
- Steps to reproduce, ideally with a minimal example.
- The affected version (run `pige status` or check `git describe`).
- Your suggested fix, if you have one.

## Response

I'll acknowledge within **7 days** and aim to ship a fix within **30 days** for confirmed issues. If the issue is critical, expect a much faster turnaround. Once the fix is released, you'll be credited in the [CHANGELOG](./CHANGELOG.md) with your permission.

## Supported versions

`pige` is a personal tool. Only the **latest released version** receives security patches. The `main` branch always reflects the latest tagged release plus unreleased work.

## Scope

In scope:

- Token handling (keychain, env var, 0600 file).
- Solidtime API client — request construction, header handling, error paths.
- Local file I/O (config, cache, token fallback file).
- Any code shipped in `dist/cli.js`.

Out of scope:

- Vulnerabilities in upstream dependencies — please report those to their respective projects. I'll bump my pinned versions as patches become available (Dependabot watches the repo).
- Misconfiguration that exposes your token *outside* `pige` (e.g., sharing `~/.config/pige/token` over a public file share).
- Theoretical issues without a concrete attack path.
