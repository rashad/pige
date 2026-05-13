import type { Context } from "../commands/context.js";
import type { EntrySource } from "../commands/today.js";
import type { TimeEntry } from "../solidtime/types.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { getToken } from "../config/keychain.js";
import { readCache, writeCache, defaultCachePath, isFresh, covers, CACHE_VERSION } from "../cache/store.js";

export function buildEntrySource(ctx: Context): EntrySource {
  return {
    async fetchEntries(fromYmd: string, toYmd: string) {
      const cachePath = defaultCachePath();
      const cached = await readCache(cachePath);
      if (!ctx.fresh && cached && isFresh(cached) && covers(cached, fromYmd, toYmd)) {
        return filterByRange(cached.entries, fromYmd, toYmd);
      }
      const token = await getToken();
      if (!token) throw new Error(ctx.t("errors.tokenAbsent"));
      const client = createSolidtimeClient({
        baseUrl: ctx.config.solidtime.baseUrl,
        token,
        organizationId: ctx.config.solidtime.organizationId,
      });
      const winFrom = ymdMinusDays(ctx.now, 60);
      const winTo   = ymdPlusDays(ctx.now, 30);
      try {
        const entries = await client.fetchTimeEntries(winFrom, winTo);
        await writeCache(cachePath, {
          version: CACHE_VERSION,
          fetchedAt: new Date().toISOString(),
          windowFrom: winFrom,
          windowTo: winTo,
          entries,
        });
        return filterByRange(entries, fromYmd, toYmd);
      } catch (e) {
        if (cached) {
          console.error(ctx.t("errors.offline", { timestamp: cached.fetchedAt }));
          return filterByRange(cached.entries, fromYmd, toYmd);
        }
        throw e;
      }
    },
  };
}

function filterByRange(entries: TimeEntry[], fromYmd: string, toYmd: string): TimeEntry[] {
  return entries.filter((e) => {
    const ymd = e.start.slice(0, 10);
    return ymd >= fromYmd && ymd <= toYmd;
  });
}

function ymdMinusDays(d: Date, n: number) {
  const out = new Date(d); out.setDate(out.getDate() - n);
  return formatYmd(out);
}
function ymdPlusDays(d: Date, n: number) {
  const out = new Date(d); out.setDate(out.getDate() + n);
  return formatYmd(out);
}
function formatYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
