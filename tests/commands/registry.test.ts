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
  it("declares per-command flags for week and cal", () => {
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
