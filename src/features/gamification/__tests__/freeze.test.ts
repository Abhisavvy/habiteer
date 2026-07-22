import { describe, it, expect } from "vitest";
import { tokensEarnedBetweenLevels } from "../freeze";

describe("tokensEarnedBetweenLevels", () => {
  it("grants 1 when crossing a multiple-of-5 level", () => {
    expect(tokensEarnedBetweenLevels(4, 5)).toBe(1);
    expect(tokensEarnedBetweenLevels(9, 10)).toBe(1);
  });
  it("grants 0 when staying within a tier", () => {
    expect(tokensEarnedBetweenLevels(5, 9)).toBe(0);
    expect(tokensEarnedBetweenLevels(1, 4)).toBe(0);
  });
  it("grants multiple when crossing more than one boundary at once", () => {
    expect(tokensEarnedBetweenLevels(4, 11)).toBe(2); // crosses 5 and 10
  });
});
