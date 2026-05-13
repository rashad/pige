import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/schema.js";
import { configPath, loadConfig, saveConfig } from "../../src/config/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fcal-cfg-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("config store", () => {
  it("returns null when file absent", async () => {
    expect(await loadConfig(configPath(dir))).toBeNull();
  });
  it("round-trips save/load", async () => {
    const path = configPath(dir);
    const cfg = { ...defaultConfig("org-1"), clients: [] };
    await saveConfig(path, cfg);
    expect(await loadConfig(path)).toEqual(cfg);
  });
  it("creates parent directory if missing", async () => {
    const path = configPath(join(dir, "nested", "deep"));
    const cfg = { ...defaultConfig("org-1"), clients: [] };
    await saveConfig(path, cfg);
    expect((await loadConfig(path))?.solidtime.organizationId).toBe("org-1");
  });
});
