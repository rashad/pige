import { expand, confirm, Separator } from "@inquirer/prompts";
import type { Context } from "./context.js";
import type { EntrySource } from "./today.js";
import { runToday } from "./today.js";
import { runWeek } from "./week.js";
import { runCal } from "./cal.js";
import { runSync } from "./sync.js";
import { runStatus } from "./status.js";
import { runConfig } from "./config.js";
import { accent } from "../render/palette.js";

type Choice = "today" | "week" | "cal" | "sync" | "config" | "status" | "quit";

export async function runMenu(ctx: Context, src: EntrySource): Promise<void> {
  while (true) {
    console.log();
    console.log(accent("pige"));
    const choice = await expand<Choice>({
      message: "Que veux-tu voir ?",
      expanded: true,
      default: "t",
      choices: [
        { key: "t", name: "Aujourd'hui", value: "today" },
        { key: "w", name: "Semaine en cours", value: "week" },
        { key: "c", name: "Calendrier du mois", value: "cal" },
        new Separator(),
        { key: "s", name: "Synchroniser maintenant", value: "sync" },
        { key: "g", name: "Configurer", value: "config" },
        { key: "i", name: "Statut", value: "status" },
        { key: "q", name: "Quitter", value: "quit" },
      ],
    });

    if (choice === "quit") return;

    console.log();
    switch (choice) {
      case "today":  await runToday(ctx, src); break;
      case "week":   await runWeek(ctx, src); break;
      case "cal":    await runCal(ctx, src, { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1 }); break;
      case "sync":   await runSync(ctx); break;
      case "status": await runStatus(ctx); break;
      case "config": await runConfig(); break;
    }

    console.log();
    const again = await confirm({ message: "Retour au menu ?", default: true });
    if (!again) return;
  }
}
