import { describe, expect, it } from "vitest";
import { accent, dim, resolveColor } from "../../src/render/palette.js";

describe("palette", () => {
  it("blue resolves to a hex", () => {
    expect(resolveColor("blue")).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it("six distinct colours", () => {
    const keys = ["blue", "green", "amber", "pink", "cyan", "purple"] as const;
    const colours = new Set(keys.map(resolveColor));
    expect(colours.size).toBe(6);
  });
  it("dim and accent return ANSI escapes (string with chars)", () => {
    expect(dim("hello")).toContain("hello");
    expect(accent("X")).toContain("X");
  });
});
