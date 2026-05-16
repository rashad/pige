import chalk from "chalk";
import { COMMANDS, GLOBAL_FLAGS } from "./registry.js";

export function runHelp(): void {
  const b = chalk.bold;
  const dim = chalk.dim;
  const cmdWidth = Math.max(...COMMANDS.map((c) => c.name.length), 12);
  const flagWidth = Math.max(...GLOBAL_FLAGS.map((f) => f.name.length), 12);
  const lines: string[] = [
    `${b("pige")}${dim(" — terminal calendar for freelance day tracking on top of Solidtime")}`,
    "",
    b("Usage"),
    "  pige [command] [flags]",
    "",
    b("Commands"),
    `  ${"(none)".padEnd(cmdWidth)}  Open the interactive menu (default).`,
  ];
  for (const c of COMMANDS) {
    if (c.name === "menu") continue; // menu is the "(none)" default above
    lines.push(`  ${c.name.padEnd(cmdWidth)}  ${c.summary}`);
  }
  lines.push("", b("Flags"));
  for (const f of GLOBAL_FLAGS) {
    if (f.name === "-h") continue; // bundled with --help
    const label = f.name === "--help" ? "--help, -h" : f.name;
    lines.push(`  ${label.padEnd(flagWidth)}  ${f.summary}`);
  }
  lines.push(
    "",
    b("Environment"),
    "  PIGE_DIR                Override the config directory (default: ~/.config/pige).",
    "  PIGE_SOLIDTIME_TOKEN    Solidtime API token (else Keychain, else 0600 file).",
  );
  console.log(lines.join("\n"));
}
