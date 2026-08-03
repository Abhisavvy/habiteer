import { describe, it, expect } from "vitest";
import { daysBetween, addDays } from "../dates";

describe("daysBetween", () => {
  it("is 0 for the same date", () => {
    expect(daysBetween("2026-01-10", "2026-01-10")).toBe(0);
  });

  it("counts forward days as positive", () => {
    expect(daysBetween("2026-01-10", "2026-01-15")).toBe(5);
  });

  it("counts backward days as negative", () => {
    expect(daysBetween("2026-01-15", "2026-01-10")).toBe(-5);
  });

  it("crosses a month boundary correctly", () => {
    expect(daysBetween("2026-01-28", "2026-02-02")).toBe(5);
  });
});

describe("addDays", () => {
  it("adds positive days, crossing a month boundary", () => {
    expect(addDays("2026-01-28", 5)).toBe("2026-02-02");
  });

  it("subtracts with a negative count", () => {
    expect(addDays("2026-02-02", -5)).toBe("2026-01-28");
  });

  it("is a no-op for 0", () => {
    expect(addDays("2026-01-10", 0)).toBe("2026-01-10");
  });
});
