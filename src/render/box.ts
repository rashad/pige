import { accent, dim } from "./palette.js";

export function roundedBox(content: string, width: number): string {
  const inner = width - 4; // 2 corners + 2 spaces
  const padded = content.length > inner ? content.slice(0, inner) : content.padEnd(inner, " ");
  const top = `╭${"─".repeat(width - 2)}╮`;
  const middle = `│ ${accent(padded)} │`;
  const bot = `╰${"─".repeat(width - 2)}╯`;
  return [dim(top), middle, dim(bot)].join("\n");
}

export function sectionSeparator(title: string, width: number): string {
  const left = "── ";
  const titleLen = title.length;
  const remaining = width - left.length - titleLen - 1;
  return `${dim("──")} ${accent(title)} ${dim("─".repeat(Math.max(remaining, 0)))}`;
}
