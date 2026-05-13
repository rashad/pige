import { confirm, expand, Separator } from "@inquirer/prompts";
import { accent } from "../render/palette.js";
import { runCal } from "./cal.js";
import { runConfig } from "./config.js";
import type { Context } from "./context.js";
import { runStatus } from "./status.js";
import { runSync } from "./sync.js";
import type { EntrySource } from "./today.js";
import { runToday } from "./today.js";
import { runWeek } from "./week.js";

type Choice = "today" | "week" | "cal" | "sync" | "config" | "status" | "quit";

export async function runMenu(ctx: Context, src: EntrySource): Promise<void> {
  while (true) {
    console.log();
    console.log(accent(ctx.t("menu.brand")));
    const choice = await expand<Choice>({
      message: ctx.t("menu.prompt"),
      expanded: true,
      default: "t",
      choices: [
        { key: "t", name: ctx.t("menu.today"), value: "today" },
        { key: "w", name: ctx.t("menu.week"), value: "week" },
        { key: "c", name: ctx.t("menu.cal"), value: "cal" },
        new Separator(),
        { key: "s", name: ctx.t("menu.sync"), value: "sync" },
        { key: "g", name: ctx.t("menu.config"), value: "config" },
        { key: "i", name: ctx.t("menu.status"), value: "status" },
        { key: "q", name: ctx.t("menu.quit"), value: "quit" },
      ],
    });

    if (choice === "quit") return;

    console.log();
    switch (choice) {
      case "today":
        await runToday(ctx, src);
        break;
      case "week":
        await runWeek(ctx, src);
        break;
      case "cal":
        await runCal(ctx, src, { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1 });
        break;
      case "sync":
        await runSync(ctx);
        break;
      case "status":
        await runStatus(ctx);
        break;
      case "config":
        await runConfig();
        break;
    }

    console.log();
    const again = await confirm({ message: ctx.t("menu.back"), default: true });
    if (!again) return;
  }
}
