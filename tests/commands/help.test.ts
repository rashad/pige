import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runHelp } from "../../src/commands/help.js";
import stripAnsi from "../helpers/stripAnsi.js";

describe("runHelp", () => {
  let logs: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("prints usage, commands, flags, and environment sections", () => {
    runHelp();
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("Usage");
    expect(out).toContain("pige [command] [flags]");
    expect(out).toContain("Commands");
    expect(out).toContain("Flags");
    expect(out).toContain("Environment");
  });

  it("lists every known subcommand", () => {
    runHelp();
    const out = stripAnsi(logs.join("\n"));
    for (const cmd of ["today", "week", "cal", "sync", "config", "status", "help"]) {
      expect(out).toContain(cmd);
    }
  });

  it("documents --fresh and --help flags", () => {
    runHelp();
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("--fresh");
    expect(out).toContain("--help");
  });

  it("documents the PIGE_DIR and PIGE_SOLIDTIME_TOKEN env vars", () => {
    runHelp();
    const out = stripAnsi(logs.join("\n"));
    expect(out).toContain("PIGE_DIR");
    expect(out).toContain("PIGE_SOLIDTIME_TOKEN");
  });
});
