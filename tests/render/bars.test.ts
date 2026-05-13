import { describe, it, expect } from "vitest";
import { progressBar } from "../../src/render/bars.js";
import stripAnsi from "../helpers/stripAnsi.js";

describe("progressBar", () => {
  it("0% renders all empty blocks", () => {
    const out = stripAnsi(progressBar(0, 10, 16, "blue"));
    expect(out).toMatch(/^░{16}$/);
  });
  it("100% renders all full blocks", () => {
    const out = stripAnsi(progressBar(10, 10, 16, "blue"));
    expect(out).toMatch(/^█{16}$/);
  });
  it("50% renders 8 full blocks", () => {
    const out = stripAnsi(progressBar(5, 10, 16, "blue"));
    expect(out.startsWith("████████")).toBe(true);
    expect(out.length).toBe(16);
  });
  it("clamps over 100%", () => {
    const out = stripAnsi(progressBar(15, 10, 16, "blue"));
    expect(out).toMatch(/^█{16}$/);
  });
  it("emits fractional block at boundary", () => {
    const out2 = stripAnsi(progressBar(2, 10, 16, "blue"));
    expect(out2.startsWith("███")).toBe(true);
  });
});
