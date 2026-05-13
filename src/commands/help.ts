import chalk from "chalk";

export function runHelp(): void {
  const b = chalk.bold;
  const dim = chalk.dim;
  const lines = [
    b("pige") + dim(" — terminal calendar for freelance day tracking on top of Solidtime"),
    "",
    b("Usage"),
    "  pige [command] [flags]",
    "",
    b("Commands"),
    "  (none)         Open the interactive menu (default).",
    "  today          Today's summary + current week.",
    "  week           Week detail. Accepts --week=N --year=YYYY.",
    "  cal            Monthly calendar. Accepts --month=YYYY-MM.",
    "  sync           Force a full fetch, rewrite the cache.",
    "  config         (Re)run the configuration wizard.",
    "  status         Token, last sync, version, paths.",
    "  help           Show this message.",
    "",
    b("Flags"),
    "  --fresh        Bypass the cache for this command.",
    "  --help, -h     Show this message.",
    "",
    b("Environment"),
    "  PIGE_DIR                Override the config directory (default: ~/.config/pige).",
    "  PIGE_SOLIDTIME_TOKEN    Solidtime API token (else Keychain, else 0600 file).",
  ];
  console.log(lines.join("\n"));
}
