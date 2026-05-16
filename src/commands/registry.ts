export type CommandFlag = { name: string; summary: string };

export type CommandSpec = {
  name: string;
  summary: string;
  flags?: CommandFlag[];
};

export const GLOBAL_FLAGS: CommandFlag[] = [
  { name: "--fresh", summary: "Bypass the cache for this command." },
  { name: "--help", summary: "Show help and exit." },
  { name: "-h", summary: "Show help and exit." },
];

export const COMMANDS: CommandSpec[] = [
  { name: "today", summary: "Today's summary + current week." },
  {
    name: "week",
    summary: "Week detail.",
    flags: [
      { name: "--week=", summary: "ISO week number." },
      { name: "--year=", summary: "ISO year (defaults to current)." },
    ],
  },
  {
    name: "cal",
    summary: "Monthly calendar.",
    flags: [{ name: "--month=", summary: "Month in YYYY-MM format." }],
  },
  { name: "sync", summary: "Force a full fetch, rewrite the cache." },
  { name: "config", summary: "(Re)run the configuration wizard." },
  { name: "status", summary: "Token, last sync, version, paths." },
  { name: "menu", summary: "Open the interactive menu (default)." },
  { name: "help", summary: "Show help." },
  {
    name: "completion",
    summary: "Print a shell completion script (e.g. `pige completion zsh`).",
  },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);
