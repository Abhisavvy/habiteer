import { describe, it, expect } from "vitest";
import { defaultCoinValue, taskCoins } from "../coins";

describe("coins", () => {
  it("defaults a habit's coin value to its difficulty base", () => {
    expect(defaultCoinValue("easy")).toBe(10);
    expect(defaultCoinValue("hard")).toBe(35);
  });
  it("pays tasks 75% of a same-effort habit base, rounded", () => {
    expect(taskCoins("easy")).toBe(8);   // round(7.5)
    expect(taskCoins("medium")).toBe(15); // round(15)
    expect(taskCoins("hard")).toBe(26);  // round(26.25)
  });
});
