# Shell completion — design

Date: 2026-05-16
Backlog item: #3

## Problem

`pige` uses no completion framework, so `pige <TAB>` does nothing in any shell. Users have to remember the seven subcommand names and the flag spellings (`--fresh`, `--week=`, `--month=`, `--year=`, `--help`). Inquirer-driven CLIs don't get this for free — completion needs an explicit per-shell script.

## Goal

A user can install zsh completion for `pige` with a single documented command, after which `pige <TAB>`, `pige cal --<TAB>`, etc. work as expected. The script is static (no runtime dependency, no shell-time `pige` call to populate the list), so it doesn't slow the shell down.

## Non-goals (v1)

- Bash and fish support. Backlog leaves these open; for v1 we ship zsh only. Adding the other two later is a separate, small per-shell script using the same data source.
- Completing flag *values* like `--month=2026-05`. The user picked subcommands + flag names only.
- Dynamic completion (e.g. completing client IDs from the loaded config). Out of scope; the offline-first, no-runtime-call rule rules this out anyway.

## Design

### Single source of truth for the command list

Three sites already enumerate the commands: `src/cli.ts:25` (`knownCmds`), `src/commands/help.ts:13-20` (rendered text), and the new completion module would be a third. To stop the drift, extract:

**New file: `src/commands/registry.ts`**

```ts
export type CommandSpec = {
  name: string;
  summary: string; // one-liner for help / completion description
  flags?: Array<{ name: string; summary: string }>; // command-specific flags
};

export const GLOBAL_FLAGS = [
  { name: "--fresh", summary: "Bypass the cache for this command." },
  { name: "--help", summary: "Show help and exit." },
] as const;

export const COMMANDS: CommandSpec[] = [
  { name: "today",  summary: "Today's summary + current week." },
  { name: "week",   summary: "Week detail.", flags: [
    { name: "--week=", summary: "ISO week number." },
    { name: "--year=", summary: "ISO year (defaults to current)." },
  ]},
  { name: "cal",    summary: "Monthly calendar.", flags: [
    { name: "--month=", summary: "Month in YYYY-MM format." },
  ]},
  { name: "sync",   summary: "Force a full fetch, rewrite the cache." },
  { name: "config", summary: "(Re)run the configuration wizard." },
  { name: "status", summary: "Token, last sync, version, paths." },
  { name: "menu",   summary: "Open the interactive menu (default)." },
  { name: "help",   summary: "Show help." },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);
```

Refactors that follow (in the same PR):
- `cli.ts:25` — `const knownCmds = new Set(COMMAND_NAMES);`
- `help.ts` — render from `COMMANDS` + `GLOBAL_FLAGS` rather than the hand-written `lines` array. The output stays byte-identical (golden test guards this).

### Completion command

**New file: `src/commands/completion.ts`**

```ts
import { COMMANDS, GLOBAL_FLAGS } from "./registry.js";

export function runCompletion(shell: string): void {
  if (shell !== "zsh") {
    console.error(`pige: completion for "${shell}" is not supported yet (try: zsh)`);
    process.exit(2);
  }
  console.log(buildZshCompletion());
}

function buildZshCompletion(): string { /* see template below */ }
```

The zsh script is built programmatically from `COMMANDS` and `GLOBAL_FLAGS` so adding a command (or a per-command flag) auto-updates the completion.

### The zsh script

Generated `_pige` script (compsys format) shape:

```zsh
#compdef pige

_pige() {
  local -a commands global_flags
  commands=(
    'today:Today'\''s summary + current week.'
    'week:Week detail.'
    'cal:Monthly calendar.'
    'sync:Force a full fetch, rewrite the cache.'
    'config:(Re)run the configuration wizard.'
    'status:Token, last sync, version, paths.'
    'menu:Open the interactive menu (default).'
    'help:Show help.'
  )
  global_flags=(
    '--fresh[Bypass the cache for this command.]'
    '--help[Show help and exit.]'
    '-h[Show help and exit.]'
  )

  _arguments -C \
    "1: :{_describe 'pige command' commands}" \
    '*:: :->cmd_args'

  case "$state" in
    cmd_args)
      case "$words[1]" in
        week)
          _arguments $global_flags '--week=[ISO week number.]' '--year=[ISO year (defaults to current).]'
          ;;
        cal)
          _arguments $global_flags '--month=[Month in YYYY-MM format.]'
          ;;
        *)
          _arguments $global_flags
          ;;
      esac
      ;;
  esac
}

compdef _pige pige
```

Generated, not committed as a static file. `pige completion zsh > /path/to/_pige` is the install flow.

### CLI routing

`src/cli.ts`:

```diff
- const knownCmds = new Set(["config", "menu", "today", "week", "cal", "sync", "status"]);
+ const knownCmds = new Set(COMMAND_NAMES);
```

Add a case for `completion`:

```ts
case "completion": {
  const shell = args.find((a) => !a.startsWith("-") && a !== "completion") ?? "";
  runCompletion(shell);
  return; // exits before loadConfig — completion must work without a configured account
}
```

`completion` is added to `COMMAND_NAMES`, listed in help, and shows up in `pige <TAB>` like every other command — discoverability is the whole point of the feature.

### Install flow (documented in README)

```bash
# Per-user install (no sudo)
pige completion zsh > "${ZDOTDIR:-$HOME}/.zfunc/_pige"
echo 'fpath=(${ZDOTDIR:-$HOME}/.zfunc $fpath); autoload -U compinit && compinit' >> ~/.zshrc

# System-wide (zsh's site-functions, requires write access)
pige completion zsh | sudo tee /usr/local/share/zsh/site-functions/_pige > /dev/null
```

README gets a "Shell completion" subsection with both snippets and a one-liner reminder: "regenerate after upgrading `pige`".

## Tests

### `tests/commands/completion.test.ts` — new file

1. **`runCompletion("zsh")` writes a script to stdout that starts with `#compdef pige` and ends with `compdef _pige pige`.** Snapshot the full script.
2. **The snapshot mentions every name in `COMMAND_NAMES`.** Iterates and asserts each appears at least once. This is the drift guard — if anyone adds a command but skips registry, the snapshot test fails.
3. **`runCompletion("bash")` exits 2 with a clear message.** Captures stderr.
4. **The snapshot mentions every flag in `GLOBAL_FLAGS` and every per-command flag declared in `COMMANDS`.** Iterates and asserts.

### `tests/commands/help.test.ts` — update

Exists today. The help renderer now reads from the registry; the existing golden assertion locks down byte-identical output across the refactor.

### `tests/cli.test.ts`

Existing CLI tests (if any) keep passing. `knownCmds` switching to `COMMAND_NAMES` is mechanically equivalent.

## Docs

`README.md`:

- New top-level section "Shell completion" with the two install snippets above and a note that only zsh is supported in v1 (bash/fish on the roadmap).
- The "Commands" reference table (if it exists; otherwise the equivalent prose section) gains a row for `completion`.

`CHANGELOG.md`:

- Under `## [Unreleased]`, add "Added: `pige completion zsh` for zsh tab-completion."

## Risk

- **Drift between `COMMAND_NAMES` and reality.** Mitigated: `cli.ts` reads from the registry, and the completion test iterates the registry and asserts each command appears in the snapshot. Forgetting to add a command to the registry will break `cli.ts` immediately (cmd rejected with `errors.unknownCmd`), so the registry will be discovered as the right source-of-truth on the first attempt.
- **zsh quoting in command descriptions.** Apostrophes inside `'today:Today's summary'` need escaping (`'\\''`). The builder must escape descriptions correctly. Test #2 implicitly exercises this for the `today` description that contains an apostrophe.
- **Refactor footprint in `help.ts`.** Switching the renderer to consume the registry risks a copy regression. The golden test prevents that.

## Out of scope (revisit later)

- Bash and fish scripts. Each gets a `buildBashCompletion()` / `buildFishCompletion()` and a router branch when needed.
- Value completion for `--month=`, `--week=`, `--year=` (date-aware suggestions).
- Dynamic completion (e.g. completing client labels from a loaded config).
- A `pige completion install` convenience subcommand that writes the file directly. Considered for v1; skipped because the install location varies per user setup and a one-line shell snippet is clearer than guessing.
