import { describe, it, expect } from "vitest";
import { expressionForStreak } from "../emberSvg";

describe("expressionForStreak", () => {
  it("is sleepy at zero streak", () => {
    expect(expressionForStreak(0)).toBe("sleepy");
  });

  it("is neutral for a modest streak", () => {
    expect(expressionForStreak(1)).toBe("neutral");
    expect(expressionForStreak(6)).toBe("neutral");
  });

  it("celebrates at 7+, matching the app's own first combo threshold", () => {
    expect(expressionForStreak(7)).toBe("celebrate");
    expect(expressionForStreak(30)).toBe("celebrate");
  });
});
