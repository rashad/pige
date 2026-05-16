import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { runCompletion } from "../../src/commands/completion.js";
import { COMMAND_NAMES, COMMANDS, GLOBAL_FLAGS } from "../../src/commands/registry.js";

describe("runCompletion zsh", () => {
  let logs: string[];
  let errs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: MockInstance<(...args: unknown[]) => never>;

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

  it("emits a zsh #compdef script that starts with #compdef pige and ends with compdef _pige pige", () => {
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
