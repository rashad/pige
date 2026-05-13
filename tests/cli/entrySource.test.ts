import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeCache,
  readCache,
  defaultCachePath,
  CACHE_VERSION,
  type Cache,
} from "../../src/cache/store.js";
import { buildEntrySource } from "../../src/cli/entrySource.js";
import { createT } from "../../src/i18n.js";
import type { Context } from "../../src/commands/context.js";
import type { Config } from "../../src/config/schema.js";

let tmpDir: string;
const t = createT("en");

const baseConfig: Config = {
  version: 1,
  solidtime: { baseUrl: "https://app.solidtime.io/api", organizationId: "org-1" },
  conversion: { hoursPerDay: 7 },
  clients: [],
  locale: "en",
  holidaysRegion: "FR",
};

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "pige-entry-"));
  process.env.PIGE_DIR = tmpDir;
  process.env.PIGE_SOLIDTIME_TOKEN = "test-token";
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.PIGE_DIR;
  delete process.env.PIGE_SOLIDTIME_TOKEN;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeCtx(now: Date, fresh = false): Context {
  return { config: baseConfig, now, fresh, locale: "en", t };
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.toString();
    return await handler(url);
  }));
}

describe("buildEntrySource", () => {
  it("returns cached entries when cache is fresh AND covers the range (no fetch)", async () => {
    const now = new Date("2026-05-15T12:00:00Z");
    const cache: Cache = {
      version: CACHE_VERSION,
      fetchedAt: new Date(Date.now() - 60_000).toISOString(), // 1 min old (wall-clock) → fresh
      windowFrom: "2026-04-01",
      windowTo: "2026-06-30",
      entries: [
        { id: "e1", start: "2026-05-10T08:00:00Z", end: "2026-05-10T16:00:00Z",
          duration: 28800, projectId: "p1", description: "", billable: true },
        { id: "e2", start: "2026-04-15T08:00:00Z", end: "2026-04-15T16:00:00Z",
          duration: 28800, projectId: "p2", description: "", billable: true },
      ],
    };
    await writeCache(defaultCachePath(), cache);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const src = buildEntrySource(makeCtx(now));
    const entries = await src.fetchEntries("2026-05-01", "2026-05-31");

    // Only e1 is within May (e2 is April), and fetch was never called.
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("e1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches from Solidtime when cache is stale, writes the new cache", async () => {
    const now = new Date("2026-05-15T12:00:00Z");

    // Stale cache (10 min old, default TTL is 5)
    await writeCache(defaultCachePath(), {
      version: CACHE_VERSION,
      fetchedAt: new Date(Date.now() - 10 * 60_000).toISOString(), // 10 min old (wall-clock) → stale (TTL 5min)
      windowFrom: "2026-04-01",
      windowTo: "2026-06-30",
      entries: [],
    });

    let fetchCalls = 0;
    stubFetch(() => {
      fetchCalls++;
      return new Response(JSON.stringify({ data: [
        { id: "fresh1", start: "2026-05-12T08:00:00Z", end: "2026-05-12T15:00:00Z",
          duration: 25200, project_id: "p1", description: "", billable: true },
      ]}), { status: 200 });
    });

    const src = buildEntrySource(makeCtx(now));
    const entries = await src.fetchEntries("2026-05-01", "2026-05-31");

    expect(fetchCalls).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("fresh1");

    // Cache file was rewritten with the new data.
    const reread = await readCache(defaultCachePath());
    expect(reread!.entries).toHaveLength(1);
    expect(reread!.entries[0]!.id).toBe("fresh1");
  });

  it("falls back to stale cache (with warning) when Solidtime fetch fails", async () => {
    const now = new Date("2026-05-15T12:00:00Z");

    await writeCache(defaultCachePath(), {
      version: CACHE_VERSION,
      fetchedAt: new Date(Date.now() - 60 * 60_000).toISOString(), // 1h old (wall-clock) → stale
      windowFrom: "2026-04-01",
      windowTo: "2026-06-30",
      entries: [
        { id: "old1", start: "2026-05-10T08:00:00Z", end: "2026-05-10T16:00:00Z",
          duration: 28800, projectId: "p1", description: "", billable: true },
      ],
    });

    // Solidtime returns 503 → after the client's 1 retry, throws.
    // Client default retryDelayMs is 500; we don't override, so this test takes ~500ms.
    stubFetch(() => new Response("upstream down", { status: 503 }));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const src = buildEntrySource(makeCtx(now));
    const entries = await src.fetchEntries("2026-05-01", "2026-05-31");

    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("old1");
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Offline"));
  });

  it("throws when fetch fails AND no cache exists", async () => {
    const now = new Date("2026-05-15T12:00:00Z");
    // No writeCache → no cache file
    stubFetch(() => new Response("upstream down", { status: 503 }));

    const src = buildEntrySource(makeCtx(now));
    await expect(src.fetchEntries("2026-05-01", "2026-05-31")).rejects.toThrow(/503/);
  });

  it("bypasses the cache when ctx.fresh is true (always refetches)", async () => {
    const now = new Date("2026-05-15T12:00:00Z");

    // Cache is fresh AND covers the range — would normally be a cache hit.
    await writeCache(defaultCachePath(), {
      version: CACHE_VERSION,
      fetchedAt: new Date(now.getTime() - 60_000).toISOString(),
      windowFrom: "2026-04-01",
      windowTo: "2026-06-30",
      entries: [
        { id: "stale_but_in_cache", start: "2026-05-10T08:00:00Z", end: "2026-05-10T15:00:00Z",
          duration: 25200, projectId: "p1", description: "", billable: true },
      ],
    });

    let fetchCalls = 0;
    stubFetch(() => {
      fetchCalls++;
      return new Response(JSON.stringify({ data: [
        { id: "from_network", start: "2026-05-12T08:00:00Z", end: "2026-05-12T15:00:00Z",
          duration: 25200, project_id: "p1", description: "", billable: true },
      ]}), { status: 200 });
    });

    const src = buildEntrySource(makeCtx(now, true)); // fresh = true
    const entries = await src.fetchEntries("2026-05-01", "2026-05-31");

    expect(fetchCalls).toBe(1);
    expect(entries[0]!.id).toBe("from_network");
  });
});
