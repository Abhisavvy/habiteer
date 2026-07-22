import { describe, it, expect } from "vitest";
import { currentStreak, periodProgress } from "../streak";

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

// Weeks (Mon-Sun, UTC) around 2026-07-22 (a Wednesday):
// week3 = 07-13..07-19, week4 (current) = 07-20..07-26
describe("currentStreak (period week, quota 3)", () => {
  it("an under-quota current week doesn't break a satisfied prior week's streak", () => {
    const completed = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-20", "2026-07-21"];
    expect(currentStreak(completed, { period: "week", quota: 3 }, "2026-07-22")).toBe(1);
  });

  it("reaching quota in the current week extends the streak to include it", () => {
    const completed = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-20", "2026-07-21", "2026-07-22"];
    expect(currentStreak(completed, { period: "week", quota: 3 }, "2026-07-22")).toBe(2);
  });

  it("a fourth completion in the same week doesn't increase the streak further", () => {
    const completed = [
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ];
    expect(currentStreak(completed, { period: "week", quota: 3 }, "2026-07-23")).toBe(2);
  });

  it("a fully elapsed under-quota week breaks the streak", () => {
    // week1 (06-29..07-05) satisfied, but week3 (immediately before the current week4) is empty.
    const completed = ["2026-06-29", "2026-06-30", "2026-07-01"];
    expect(currentStreak(completed, { period: "week", quota: 3 }, "2026-07-22")).toBe(0);
  });
});

describe("periodProgress", () => {
  it("counts completions in the current week against quota", () => {
    expect(periodProgress(["2026-07-20", "2026-07-21"], "week", 3, "2026-07-22")).toEqual({
      completed: 2,
      quota: 3,
    });
  });

  it("is zero when nothing has been completed this period yet", () => {
    expect(periodProgress([], "week", 3, "2026-07-22")).toEqual({ completed: 0, quota: 3 });
  });
});

describe("currentStreak (period month, quota 1)", () => {
  it("counts consecutive satisfied months, including the current one once satisfied", () => {
    expect(currentStreak(["2026-07-05"], { period: "month", quota: 1 }, "2026-07-22")).toBe(1);
  });

  it("a satisfied prior month still counts even if the current month is untouched so far", () => {
    expect(currentStreak(["2026-06-15"], { period: "month", quota: 1 }, "2026-07-22")).toBe(1);
  });

  it("accumulates across consecutive satisfied months", () => {
    const completed = ["2026-05-10", "2026-06-10", "2026-07-10"];
    expect(currentStreak(completed, { period: "month", quota: 1 }, "2026-07-22")).toBe(3);
  });
});
