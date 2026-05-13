import { describe, it, expect } from "vitest";
import { roundedBox, sectionSeparator } from "../../src/render/box.js";
import stripAnsi from "../helpers/stripAnsi.js";

describe("roundedBox", () => {
  it("wraps text in rounded corners", () => {
    const out = stripAnsi(roundedBox("Hello", 20));
    expect(out).toContain("╭");
    expect(out).toContain("╮");
    expect(out).toContain("╰");
    expect(out).toContain("╯");
    expect(out).toContain("Hello");
  });
  it("respects width", () => {
    const out = stripAnsi(roundedBox("Hi", 10)).split("\n");
    expect(out[0]!.length).toBe(10);
  });
});

describe("sectionSeparator", () => {
  it("renders title with dashes", () => {
    const out = stripAnsi(sectionSeparator("Mois", 30));
    expect(out).toContain("Mois");
    expect(out).toMatch(/─+/);
    expect(out.length).toBe(30);
  });
});
