import { COMMANDS, type CommandFlag, GLOBAL_FLAGS } from "./registry.js";

export function runCompletion(shell: string): void {
  if (shell !== "zsh") {
    console.error(`pige: completion for "${shell}" is not supported yet (try: zsh)`);
    process.exit(2);
  }
  console.log(buildZshCompletion());
}

function zshEscape(s: string): string {
  // Inside a zsh single-quoted string, ' must become '\''
  return s.replaceAll("'", "'\\''");
}

function flagSpec(f: CommandFlag): string {
  return `'${f.name}[${zshEscape(f.summary)}]'`;
}

function buildZshCompletion(): string {
  const commandLines = COMMANDS.map((c) => `    '${c.name}:${zshEscape(c.summary)}'`).join("\n");

  const globalFlagLines = GLOBAL_FLAGS.map((f) => `    '${f.name}[${zshEscape(f.summary)}]'`).join("\n");

  const perCommandCases = COMMANDS.filter((c) => c.flags && c.flags.length > 0)
    .map((c) => {
      const flagArgs = (c.flags ?? []).map(flagSpec).join(" ");
      return `        ${c.name})\n          _arguments $global_flags ${flagArgs}\n          ;;`;
    })
    .join("\n");

  return `#compdef pige

_pige() {
  local -a commands global_flags
  commands=(
${commandLines}
  )
  global_flags=(
${globalFlagLines}
  )

  _arguments -C \\
    "1: :{_describe 'pige command' commands}" \\
    '*:: :->cmd_args'

  case "$state" in
    cmd_args)
      case "$words[1]" in
${perCommandCases}
        *)
          _arguments $global_flags
          ;;
      esac
      ;;
  esac
}

compdef _pige pige
`;
}
