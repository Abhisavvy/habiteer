import { describe, it, expect } from "vitest";
import { currentStreak } from "../streak";

describe("currentStreak (daily)", () => {
  it("counts consecutive completed days", () => {
    expect(currentStreak(["2026-07-08", "2026-07-09", "2026-07-10"], {}, "2026-07-10")).toBe(3);
  });
  it("does not break when today is not done yet (grace)", () => {
    expect(currentStreak(["2026-07-08", "2026-07-09"], {}, "2026-07-10")).toBe(2);
  });
  it("breaks on a missed past day", () => {
    expect(currentStreak(["2026-07-10", "2026-07-08"], {}, "2026-07-10")).toBe(1);
  });
});

describe("currentStreak (specific weekdays Mon/Wed/Fri)", () => {
  it("skips unscheduled days without breaking", () => {
    // 2026-01-05 Mon, 01-07 Wed, 01-09 Fri
    expect(
      currentStreak(["2026-01-05", "2026-01-07", "2026-01-09"], { weekdays: [1, 3, 5] }, "2026-01-09")
    ).toBe(3);
  });
});
