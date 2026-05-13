import type { Context } from "./context.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { getToken } from "../config/keychain.js";
import { writeCache, defaultCachePath, CACHE_VERSION } from "../cache/store.js";
import { dim, accent } from "../render/palette.js";

export async function runSync(ctx: Context): Promise<void> {
  const token = await getToken();
  if (!token) {
    console.error("❌ Token Solidtime absent. Lance `freelance config`.");
    process.exit(1);
  }
  const client = createSolidtimeClient({
    baseUrl: ctx.config.solidtime.baseUrl,
    token,
    organizationId: ctx.config.solidtime.organizationId,
  });

  const to = new Date(ctx.now);
  const from = new Date(ctx.now);
  from.setDate(from.getDate() - 90);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  console.log(dim("Synchronisation…"));
  const entries = await client.fetchTimeEntries(fmt(from), fmt(to));
  await writeCache(defaultCachePath(), {
    version: CACHE_VERSION,
    fetchedAt: new Date().toISOString(),
    windowFrom: fmt(from),
    windowTo: fmt(to),
    entries,
  });
  console.log(`${accent("✓")} ${entries.length} entries synced.`);
}
