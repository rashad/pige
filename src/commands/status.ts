import type { Context } from "./context.js";
import { getToken } from "../config/keychain.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { readCache, defaultCachePath } from "../cache/store.js";
import { configPath } from "../config/store.js";
import { accent, dim } from "../render/palette.js";

export async function runStatus(ctx: Context): Promise<void> {
  console.log(accent("pige · statut"));
  console.log();

  console.log(`   ${dim("Config :")} ${configPath()}`);
  console.log(`   ${dim("Org    :")} ${ctx.config.solidtime.organizationId}`);
  console.log(`   ${dim("Clients :")} ${ctx.config.clients.length}`);

  const tok = await getToken();
  if (!tok) {
    console.log(`   ${dim("Token  :")} ❌ absent`);
  } else {
    try {
      const c = createSolidtimeClient({
        baseUrl: ctx.config.solidtime.baseUrl,
        token: tok,
        organizationId: ctx.config.solidtime.organizationId,
      });
      const me = await c.getMe();
      console.log(`   ${dim("Token  :")} ✓ valide (${me.email})`);
    } catch {
      console.log(`   ${dim("Token  :")} ❌ rejeté par Solidtime`);
    }
  }

  const cache = await readCache(defaultCachePath());
  if (cache) {
    const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
    const ageMin = Math.round(ageMs / 60000);
    console.log(`   ${dim("Cache  :")} ${cache.entries.length} entries, sync il y a ${ageMin} min`);
  } else {
    console.log(`   ${dim("Cache  :")} vide`);
  }
}
