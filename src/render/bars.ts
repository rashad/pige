import type { ColorKey } from "../config/schema.js";
import { barColor, barTrack } from "./palette.js";

const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]; // 0..8 eighths

export function progressBar(value: number, max: number, width: number, color: ColorKey): string {
  const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const totalEighths = Math.round(ratio * width * 8);
  const fullCells = Math.floor(totalEighths / 8);
  const remainder = totalEighths % 8;

  let bar = "█".repeat(fullCells);
  if (fullCells < width && remainder > 0) {
    bar += BLOCKS[remainder];
  }
  const filledLen = [...bar].length;
  const emptyLen = width - filledLen;

  return barColor(bar, color) + barTrack("░".repeat(emptyLen));
}
