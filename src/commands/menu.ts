import { select, confirm } from "@inquirer/prompts";
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
    console.log(accent("freelance"));
    const choice = (await select<Choice>({
      message: "Que veux-tu voir ?",
      choices: [
        { name: "Aujourd'hui              (t)", value: "today" },
        { name: "Semaine en cours         (w)", value: "week" },
        { name: "Calendrier du mois       (c)", value: "cal" },
        { name: "Synchroniser maintenant  (s)", value: "sync" },
        { name: "Configurer               (g)", value: "config" },
        { name: "Statut                   (i)", value: "status" },
        { name: "Quitter                  (q)", value: "quit" },
      ],
    })) as Choice;

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
