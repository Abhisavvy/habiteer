import { describe, it, expect } from "vitest";
import { comboMultiplier } from "../combo";

describe("comboMultiplier", () => {
  it("is 1x below the first tier", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(1);
  });
  it("steps up at each tier boundary", () => {
    expect(comboMultiplier(3)).toBe(1.2);
    expect(comboMultiplier(6)).toBe(1.2);
    expect(comboMultiplier(7)).toBe(1.5);
    expect(comboMultiplier(13)).toBe(1.5);
    expect(comboMultiplier(14)).toBe(2);
    expect(comboMultiplier(29)).toBe(2);
    expect(comboMultiplier(30)).toBe(3);
    expect(comboMultiplier(100)).toBe(3);
  });
});
