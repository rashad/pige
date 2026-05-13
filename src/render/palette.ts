import chalk from "chalk";
import type { ColorKey } from "../config/schema.js";

// Catppuccin-inspired palette (mocha)
const PALETTE: Record<ColorKey, string> = {
  blue: "#89b4fa",
  green: "#a6e3a1",
  amber: "#f9e2af",
  pink: "#f5c2e7",
  cyan: "#94e2d5",
  purple: "#cba6f7",
};

const FG_ON_COLOR = "#1e1e2e";
const NEUTRAL_BG = "#313244";
const NEUTRAL_FG = "#6c7086";

export function resolveColor(key: ColorKey): string {
  return PALETTE[key];
}

export function dim(s: string): string {
  return chalk.hex(NEUTRAL_FG)(s);
}

export function accent(s: string): string {
  return chalk.hex("#cdd6f4").bold(s);
}

export function clientCell(s: string, color: ColorKey): string {
  return chalk.hex(FG_ON_COLOR).bgHex(PALETTE[color])(s);
}

export function neutralCell(s: string): string {
  return chalk.hex(NEUTRAL_FG).bgHex(NEUTRAL_BG)(s);
}

export function emptyCell(s: string): string {
  return chalk.hex(NEUTRAL_FG)(s);
}

export function barColor(s: string, color: ColorKey): string {
  return chalk.hex(PALETTE[color])(s);
}

export function barTrack(s: string): string {
  return chalk.hex(NEUTRAL_BG)(s);
}
