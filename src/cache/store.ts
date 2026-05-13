import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultConfigDir } from "../config/store.js";
import type { TimeEntry } from "../solidtime/types.js";

export const CACHE_VERSION = 1 as const;
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type Cache = {
  version: typeof CACHE_VERSION;
  fetchedAt: string; // ISO timestamp
  windowFrom: string; // YYYY-MM-DD
  windowTo: string; // YYYY-MM-DD
  entries: TimeEntry[];
};

export function defaultCachePath(): string {
  return join(defaultConfigDir(), "cache.json");
}

export async function readCache(path: string = defaultCachePath()): Promise<Cache | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Cache;
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

export async function writeCache(path: string, cache: Cache): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache), { mode: 0o600 });
}

export function isFresh(cache: Cache, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  return age >= 0 && age < ttlMs;
}

export function covers(cache: Cache, fromIso: string, toIso: string): boolean {
  return cache.windowFrom <= fromIso && cache.windowTo >= toIso;
}
