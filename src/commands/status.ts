import type { Context } from "./context.js";
import { getToken } from "../config/keychain.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { readCache, defaultCachePath } from "../cache/store.js";
import { configPath } from "../config/store.js";
import { accent, dim } from "../render/palette.js";

export async function runStatus(ctx: Context): Promise<void> {
  console.log(accent(ctx.t("status.title")));
  console.log();

  console.log(`   ${dim(ctx.t("status.config"))} ${configPath()}`);
  console.log(`   ${dim(ctx.t("status.org"))} ${ctx.config.solidtime.organizationId}`);
  console.log(`   ${dim(ctx.t("status.clients"))} ${ctx.config.clients.length}`);

  const tok = await getToken();
  if (!tok) {
    console.log(`   ${dim(ctx.t("status.token"))} ${ctx.t("status.tokenAbsent")}`);
  } else {
    try {
      const c = createSolidtimeClient({
        baseUrl: ctx.config.solidtime.baseUrl,
        token: tok,
        organizationId: ctx.config.solidtime.organizationId,
      });
      const me = await c.getMe();
      console.log(`   ${dim(ctx.t("status.token"))} ${ctx.t("status.tokenValid", { email: me.email })}`);
    } catch {
      console.log(`   ${dim(ctx.t("status.token"))} ${ctx.t("status.tokenRejected")}`);
    }
  }

  const cache = await readCache(defaultCachePath());
  if (cache) {
    const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
    const ageMin = Math.round(ageMs / 60000);
    console.log(`   ${dim(ctx.t("status.cache"))} ${ctx.t("status.cacheEntries", { n: cache.entries.length, min: ageMin })}`);
  } else {
    console.log(`   ${dim(ctx.t("status.cache"))} ${ctx.t("status.cacheEmpty")}`);
  }
}
