# Zsh Shell Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `pige completion zsh` that emits a static zsh completion script covering subcommands and flag names. Eliminate command-list drift by introducing a single registry consumed by `cli.ts`, `help.ts`, and the new emitter.

**Architecture:** New `src/commands/registry.ts` holds the canonical `COMMANDS` list. `cli.ts` derives `knownCmds` from it; `help.ts` renders from it; `src/commands/completion.ts` builds a zsh `_pige` function from it. Only zsh in v1; bash/fish branches will share the registry when added later.

**Tech Stack:** Node.js ≥ 20, TypeScript strict, vitest. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-16-shell-completion-design.md`

---

### Task 1: Add the command registry

**Files:**
- Create: `src/commands/registry.ts`
- Test: `tests/commands/registry.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/commands/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMMAND_NAMES, COMMANDS, GLOBAL_FLAGS } from "../../src/commands/registry.js";

describe("command registry", () => {
  it("exposes every command currently routed by cli.ts", () => {
    const expected = ["today", "week", "cal", "sync", "config", "status", "menu", "help", "completion"];
    expect(COMMAND_NAMES.sort()).toEqual(expected.sort());
  });
  it("every command has a non-empty summary", () => {
    for (const c of COMMANDS) {
      expect(c.summary.length).toBeGreaterThan(0);
    }
  });
  it("declares per-command flags for week, cal, and completion", () => {
    const flagsByCmd = new Map(COMMANDS.map((c) => [c.name, c.flags ?? []]));
    expect(flagsByCmd.get("week")?.map((f) => f.name)).toEqual(["--week=", "--year="]);
    expect(flagsByCmd.get("cal")?.map((f) => f.name)).toEqual(["--month="]);
  });
  it("global flags include --fresh, --help, -h", () => {
    const names = GLOBAL_FLAGS.map((f) => f.name);
    expect(names).toContain("--fresh");
    expect(names).toContain("--help");
    expect(names).toContain("-h");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/commands/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the registry**

Create `src/commands/registry.ts`:

```ts
export type CommandFlag = { name: string; summary: string };

export type CommandSpec = {
  name: string;
  summary: string;
  flags?: CommandFlag[];
};

export const GLOBAL_FLAGS: CommandFlag[] = [
  { name: "--fresh", summary: "Bypass the cache for this command." },
  { name: "--help", summary: "Show help and exit." },
  { name: "-h", summary: "Show help and exit." },
];

export const COMMANDS: CommandSpec[] = [
  { name: "today", summary: "Today's summary + current week." },
  {
    name: "week",
    summary: "Week detail.",
    flags: [
      { name: "--week=", summary: "ISO week number." },
      { name: "--year=", summary: "ISO year (defaults to current)." },
    ],
  },
  {
    name: "cal",
    summary: "Monthly calendar.",
    flags: [{ name: "--month=", summary: "Month in YYYY-MM format." }],
  },
  { name: "sync", summary: "Force a full fetch, rewrite the cache." },
  { name: "config", summary: "(Re)run the configuration wizard." },
  { name: "status", summary: "Token, last sync, version, paths." },
  { name: "menu", summary: "Open the interactive menu (default)." },
  { name: "help", summary: "Show help." },
  { name: "completion", summary: "Print a shell completion script (e.g. `pige completion zsh`)." },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/commands/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/registry.ts tests/commands/registry.test.ts
git commit -m "feat(commands): introduce a single command registry"
```

---

### Task 2: Refactor `cli.ts` and `help.ts` to read from the registry

**Files:**
- Modify: `src/cli.ts:25` (replace the hard-coded `Set`)
- Modify: `src/commands/help.ts` (render from `COMMANDS` + `GLOBAL_FLAGS`)
- Test: `tests/commands/help.test.ts` (golden assertions must still pass)

- [ ] **Step 1: Update `src/cli.ts:25`**

Replace:

```ts
const knownCmds = new Set(["config", "menu", "today", "week", "cal", "sync", "status"]);
```

with:

```ts
const knownCmds = new Set(COMMAND_NAMES);
```

Add the import near the top of the file:

```ts
import { COMMAND_NAMES } from "./commands/registry.js";
```

(The `help` and `completion` commands are short-circuited above the `knownCmds` check or via direct routing in Tasks 4 / pre-existing help handling. The Set now includes them, which is fine — `help` is currently handled by the early `--help`/`-h` branch at line 17-20 and would also accept `pige help` via the `knownCmds` path. Both routes are valid.)

- [ ] **Step 2: Rewrite `runHelp` to render from the registry**

Replace the body of `src/commands/help.ts`:

```ts
import chalk from "chalk";
import { COMMANDS, GLOBAL_FLAGS } from "./registry.js";

export function runHelp(): void {
  const b = chalk.bold;
  const dim = chalk.dim;
  const cmdWidth = Math.max(...COMMANDS.map((c) => c.name.length), 12);
  const flagWidth = Math.max(...GLOBAL_FLAGS.map((f) => f.name.length), 12);
  const lines: string[] = [
    `${b("pige")}${dim(" — terminal calendar for freelance day tracking on top of Solidtime")}`,
    "",
    b("Usage"),
    "  pige [command] [flags]",
    "",
    b("Commands"),
    `  ${"(none)".padEnd(cmdWidth)}  Open the interactive menu (default).`,
  ];
  for (const c of COMMANDS) {
    if (c.name === "menu") continue; // menu is the "(none)" default above
    lines.push(`  ${c.name.padEnd(cmdWidth)}  ${c.summary}`);
  }
  lines.push("", b("Flags"));
  for (const f of GLOBAL_FLAGS) {
    if (f.name === "-h") continue; // bundled with --help
    const label = f.name === "--help" ? "--help, -h" : f.name;
    lines.push(`  ${label.padEnd(flagWidth)}  ${f.summary}`);
  }
  lines.push(
    "",
    b("Environment"),
    "  PIGE_DIR                Override the config directory (default: ~/.config/pige).",
    "  PIGE_SOLIDTIME_TOKEN    Solidtime API token (else Keychain, else 0600 file).",
  );
  console.log(lines.join("\n"));
}
```

- [ ] **Step 3: Run the help tests**

Run: `npx vitest run tests/commands/help.test.ts`
Expected: PASS — the existing assertions look for substrings (`"today"`, `"Usage"`, `"--fresh"`, etc.). The substring assertions tolerate column-padding differences.

If any assertion fails because of formatting drift, prefer adjusting the renderer's whitespace to match the previous output rather than weakening the test.

- [ ] **Step 4: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/commands/help.ts
git commit -m "refactor(commands): cli.ts and help.ts read from the registry"
```

---

### Task 3: Implement `runCompletion(shell)` (zsh only)

**Files:**
- Create: `src/commands/completion.ts`
- Test: `tests/commands/completion.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/completion.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCompletion } from "../../src/commands/completion.js";
import { COMMAND_NAMES, COMMANDS, GLOBAL_FLAGS } from "../../src/commands/registry.js";

describe("runCompletion zsh", () => {
  let logs: string[];
  let errs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    errs = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    errSpy = vi.spyOn(console, "error").mockImplementation((s: string) => {
      errs.push(s);
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
      throw new Error("process.exit called");
    }) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("emits a zsh #compdef script that ends with compdef _pige pige", () => {
    runCompletion("zsh");
    const out = logs.join("\n");
    expect(out.startsWith("#compdef pige")).toBe(true);
    expect(out.trimEnd().endsWith("compdef _pige pige")).toBe(true);
  });

  it("mentions every command name from the registry", () => {
    runCompletion("zsh");
    const out = logs.join("\n");
    for (const name of COMMAND_NAMES) {
      expect(out).toContain(name);
    }
  });

  it("mentions every global flag and every per-command flag", () => {
    runCompletion("zsh");
    const out = logs.join("\n");
    for (const f of GLOBAL_FLAGS) {
      expect(out).toContain(f.name);
    }
    for (const c of COMMANDS) {
      for (const f of c.flags ?? []) {
        expect(out).toContain(f.name);
      }
    }
  });

  it("escapes apostrophes in command descriptions", () => {
    runCompletion("zsh");
    const out = logs.join("\n");
    // "Today's summary..." -> zsh single-quoted strings need '\'' to escape '
    expect(out).toContain("Today'\\''s summary");
  });

  it("exits 2 with a clear error for unsupported shells", () => {
    expect(() => runCompletion("bash")).toThrow("process.exit called");
    expect(errs.join("\n")).toMatch(/not supported|try.*zsh/i);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/commands/completion.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/commands/completion.ts`:

```ts
import { COMMANDS, type CommandFlag, GLOBAL_FLAGS } from "./registry.js";

export function runCompletion(shell: string): void {
  if (shell !== "zsh") {
    console.error(`pige: completion for "${shell}" is not supported yet (try: zsh)`);
    process.exit(2);
  }
  console.log(buildZshCompletion());
}

function zshEscape(s: string): string {
  // Inside a zsh single-quoted string, ' must become '\''
  return s.replaceAll("'", "'\\''");
}

function flagSpec(f: CommandFlag): string {
  return `'${f.name}[${zshEscape(f.summary)}]'`;
}

function buildZshCompletion(): string {
  const commandLines = COMMANDS.map(
    (c) => `    '${c.name}:${zshEscape(c.summary)}'`,
  ).join("\n");

  const globalFlagLines = GLOBAL_FLAGS.map(
    (f) => `    '${f.name}[${zshEscape(f.summary)}]'`,
  ).join("\n");

  const perCommandCases = COMMANDS.filter((c) => c.flags && c.flags.length > 0)
    .map((c) => {
      const flagArgs = (c.flags ?? []).map(flagSpec).join(" ");
      return `        ${c.name})\n          _arguments $global_flags ${flagArgs}\n          ;;`;
    })
    .join("\n");

  return `#compdef pige

_pige() {
  local -a commands global_flags
  commands=(
${commandLines}
  )
  global_flags=(
${globalFlagLines}
  )

  _arguments -C \\
    "1: :{_describe 'pige command' commands}" \\
    '*:: :->cmd_args'

  case "$state" in
    cmd_args)
      case "$words[1]" in
${perCommandCases}
        *)
          _arguments $global_flags
          ;;
      esac
      ;;
  esac
}

compdef _pige pige
`;
}
```

- [ ] **Step 4: Run the test file**

Run: `npx vitest run tests/commands/completion.test.ts`
Expected: PASS — all five cases.

- [ ] **Step 5: Run typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/completion.ts tests/commands/completion.test.ts
git commit -m "feat(completion): add 'pige completion zsh' emitter"
```

---

### Task 4: Wire `completion` into `cli.ts` routing

**Files:**
- Modify: `src/cli.ts` (add a `case "completion"` branch that runs before `loadConfig`)
- Test: hand verification (no test — the CLI entry point isn't unit-tested today)

- [ ] **Step 1: Add the import**

In `src/cli.ts`, add to the imports near the top:

```ts
import { runCompletion } from "./commands/completion.js";
```

- [ ] **Step 2: Route the command before `loadConfig`**

After the `cmd === "config"` branch (around `src/cli.ts:33-36`), add:

```ts
if (cmd === "completion") {
  const shell = args.find((a) => !a.startsWith("-") && a !== "completion") ?? "";
  runCompletion(shell);
  return;
}
```

This must run before `loadConfig()` (line 38) so completion works on a fresh install with no config yet.

- [ ] **Step 3: Hand-run the command**

```bash
npm run dev -- completion zsh
```

Expected: a `#compdef pige` script printed to stdout, ending with `compdef _pige pige`.

```bash
npm run dev -- completion bash
```

Expected: error on stderr, exit code 2.

```bash
echo $?
```

Expected: `2`.

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): route 'pige completion <shell>' before config load"
```

---

### Task 5: Document install in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Shell completion" section**

Pick a spot near the top-level usage section. Insert:

````markdown
## Shell completion

Zsh is supported in v1 (bash and fish on the roadmap).

```bash
# Per-user install (no sudo)
mkdir -p "${ZDOTDIR:-$HOME}/.zfunc"
pige completion zsh > "${ZDOTDIR:-$HOME}/.zfunc/_pige"
# Add once to ~/.zshrc:
#   fpath=(${ZDOTDIR:-$HOME}/.zfunc $fpath)
#   autoload -U compinit && compinit

# System-wide (requires write access)
pige completion zsh | sudo tee /usr/local/share/zsh/site-functions/_pige > /dev/null
```

Regenerate `_pige` after every `pige` upgrade to pick up new commands or flags.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): document zsh shell-completion install"
```

---

### Task 6: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the entry under `## [Unreleased]`**

If `## [Unreleased]` has no `### Added` subsection, add one. The entry:

```markdown
### Added

- `pige completion zsh` emits a static zsh completion script covering
  every subcommand and flag. See README for install steps.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add zsh completion entry"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the full CI gate locally**

Run: `npm run check && npm run typecheck && npm test && npm run build`
Expected: All four steps PASS.

- [ ] **Step 2: Smoke-test the completion script in a real zsh**

```bash
npm run build
node dist/cli.js completion zsh > /tmp/_pige
# In a fresh zsh:
zsh -c "fpath=(/tmp $fpath); autoload -U compinit && compinit -u; source /tmp/_pige; print -l ${(k)_comps[pige]}"
```

A simpler check: `zsh -c "source /tmp/_pige"` should not produce a parse error.

```bash
zsh -n /tmp/_pige
```

Expected: no output (script parses cleanly). If `zsh -n` errors, the emitter is producing invalid syntax — likely an unescaped apostrophe; check `zshEscape` and the test that pins it.

---

## Done when

- `COMMANDS`, `COMMAND_NAMES`, and `GLOBAL_FLAGS` are the single source of truth across `cli.ts`, `help.ts`, and `completion.ts`.
- `pige completion zsh` prints a `#compdef pige` script that parses with `zsh -n`.
- `pige completion bash` exits 2 with a clear error.
- The completion test iterates the registry and asserts every command name and flag appears in the emitted script (drift guard).
- README has install instructions.
- CHANGELOG has an `Added` entry.
- `npm run check && npm run typecheck && npm test && npm run build` is green.
