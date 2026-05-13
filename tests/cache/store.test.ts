import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { covers, isFresh, readCache, writeCache } from "../../src/cache/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fcal-cache-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("cache store", () => {
  it("returns null if missing", async () => {
    expect(await readCache(join(dir, "c.json"))).toBeNull();
  });

  it("round-trips", async () => {
    const path = join(dir, "c.json");
    const payload = {
      version: 1 as const,
      fetchedAt: "2026-05-13T10:00:00Z",
      windowFrom: "2026-02-13",
      windowTo: "2026-05-13",
      entries: [],
    };
    await writeCache(path, payload);
    expect(await readCache(path)).toEqual(payload);
  });

  it("isFresh returns false past TTL", () => {
    const cache = {
      version: 1 as const,
      fetchedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      windowFrom: "2026-01-01",
      windowTo: "2026-05-13",
      entries: [],
    };
    expect(isFresh(cache, 5 * 60 * 1000)).toBe(false);
  });

  it("isFresh returns true within TTL", () => {
    const cache = {
      version: 1 as const,
      fetchedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      windowFrom: "2026-01-01",
      windowTo: "2026-05-13",
      entries: [],
    };
    expect(isFresh(cache, 5 * 60 * 1000)).toBe(true);
  });

  it("covers checks window inclusion", () => {
    const cache = {
      version: 1 as const,
      fetchedAt: new Date().toISOString(),
      windowFrom: "2026-02-01",
      windowTo: "2026-05-31",
      entries: [],
    };
    expect(covers(cache, "2026-03-01", "2026-04-01")).toBe(true);
    expect(covers(cache, "2026-01-15", "2026-04-01")).toBe(false);
  });
});
