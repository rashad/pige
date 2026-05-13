#!/usr/bin/env node
import { buildEntrySource } from "./cli/entrySource.js";
import { runCal } from "./commands/cal.js";
import { runConfig } from "./commands/config.js";
import { runHelp } from "./commands/help.js";
import { runMenu } from "./commands/menu.js";
import { runStatus } from "./commands/status.js";
import { runSync } from "./commands/sync.js";
import { runToday } from "./commands/today.js";
import { runWeek } from "./commands/week.js";
import { loadConfig } from "./config/store.js";
import { createT, detectSystemLocale, normalizeLocale } from "./i18n.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args[0] === "help") {
    runHelp();
    return;
  }

  const fresh = args.includes("--fresh");
  const cmd = args.find((a) => !a.startsWith("--")) ?? "menu";

  const knownCmds = new Set(["config", "menu", "today", "week", "cal", "sync", "status"]);
  if (!knownCmds.has(cmd)) {
    const bootLocale = detectSystemLocale();
    const bootT = createT(bootLocale);
    console.error(bootT("errors.unknownCmd", { cmd }));
    process.exit(2);
  }

  if (cmd === "config") {
    await runConfig();
    return;
  }

  const config = await loadConfig();
  if (!config) {
    const bootLocale = detectSystemLocale();
    const bootT = createT(bootLocale);
    console.log(bootT("errors.noConfig"));
    await runConfig();
    return;
  }

  const locale = normalizeLocale(config.locale);
  const t = createT(locale);
  const ctx = { config, now: new Date(), fresh, locale, t };
  const src = buildEntrySource(ctx);

  switch (cmd) {
    case "menu":
      await runMenu(ctx, src);
      break;
    case "today":
      await runToday(ctx, src);
      break;
    case "week": {
      const wkArg = args.find((a) => a.startsWith("--week="));
      const yrArg = args.find((a) => a.startsWith("--year="));
      let anchor: Date | undefined;
      if (wkArg) {
        const wk = parseInt(wkArg.split("=")[1] ?? "", 10);
        const yr = yrArg ? parseInt(yrArg.split("=")[1] ?? "", 10) : ctx.now.getFullYear();
        if (!Number.isNaN(wk) && !Number.isNaN(yr)) {
          const jan4 = new Date(yr, 0, 4);
          const jan4Day = (jan4.getDay() + 6) % 7;
          anchor = new Date(jan4);
          anchor.setDate(jan4.getDate() - jan4Day + (wk - 1) * 7 + 3);
        }
      }
      await runWeek(ctx, src, anchor ? { date: anchor } : undefined);
      break;
    }
    case "cal": {
      const monthArg = args.find((a) => a.startsWith("--month="));
      let year = ctx.now.getFullYear();
      let month = ctx.now.getMonth() + 1;
      if (monthArg) {
        const v = monthArg.split("=")[1] ?? "";
        const m = v.match(/^(\d{4})-(\d{2})$/);
        if (m?.[1] && m[2]) {
          year = parseInt(m[1], 10);
          month = parseInt(m[2], 10);
        }
      }
      await runCal(ctx, src, { year, month });
      break;
    }
    case "sync":
      await runSync(ctx);
      break;
    case "status":
      await runStatus(ctx);
      break;
    default: {
      const bootLocale = detectSystemLocale();
      const bootT = createT(bootLocale);
      console.error(bootT("errors.unknownCmd", { cmd }));
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
