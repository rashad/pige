import { CACHE_VERSION, defaultCachePath, writeCache } from "../cache/store.js";
import { getToken } from "../config/keychain.js";
import { accent, dim } from "../render/palette.js";
import { createOrgClient } from "../solidtime/client.js";
import type { Context } from "./context.js";

export async function runSync(ctx: Context): Promise<void> {
  const token = await getToken();
  if (!token) {
    console.error(`❌ ${ctx.t("errors.tokenAbsent")}`);
    process.exit(1);
  }
  const client = createOrgClient({
    baseUrl: ctx.config.solidtime.baseUrl,
    token,
    organizationId: ctx.config.solidtime.organizationId,
  });

  // Match the window entrySource expects: [-60d, +30d] around now.
  const from = new Date(ctx.now);
  from.setDate(from.getDate() - 60);
  const to = new Date(ctx.now);
  to.setDate(to.getDate() + 30);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  console.log(dim(ctx.t("sync.start")));
  const entries = await client.fetchTimeEntries(fmt(from), fmt(to));
  await writeCache(defaultCachePath(), {
    version: CACHE_VERSION,
    fetchedAt: new Date().toISOString(),
    windowFrom: fmt(from),
    windowTo: fmt(to),
    entries,
  });
  console.log(`${accent("✓")} ${ctx.t("sync.done", { n: entries.length })}`);
}
