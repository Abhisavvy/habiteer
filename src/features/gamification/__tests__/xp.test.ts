import { describe, it, expect } from "vitest";
import { xpForHabit, levelInfo } from "../xp";

describe("xpForHabit", () => {
  it("pays base with no combo", () => {
    expect(xpForHabit("easy", 0)).toBe(10);
    expect(xpForHabit("medium", 2)).toBe(20);
  });
  it("applies the combo multiplier", () => {
    expect(xpForHabit("medium", 7)).toBe(30); // 20 * 1.5
    expect(xpForHabit("hard", 30)).toBe(105); // 35 * 3
  });
});

describe("levelInfo", () => {
  it("starts at level 1", () => {
    expect(levelInfo(0)).toEqual({ level: 1, intoLevel: 0, need: 100 });
    expect(levelInfo(99)).toEqual({ level: 1, intoLevel: 99, need: 100 });
  });
  it("advances a level once the requirement is cleared", () => {
    const info = levelInfo(100);
    expect(info.level).toBe(2);
    expect(info.intoLevel).toBe(0);
    expect(info.need).toBe(246); // round(100 * 2^1.3)
  });
});
