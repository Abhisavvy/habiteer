import { describe, it, expect } from "vitest";
import { goalStatus, maxAchievableInWindow, type Goal } from "../derived";
import type { Completion } from "@/features/completions/api";

function completion(overrides: Partial<Completion>): Completion {
  return {
    id: "c1",
    trackableId: "t1",
    completedOn: "2026-01-01",
    xpEarned: 10,
    coinsEarned: 10,
    streakAfter: 1,
    freezeSpent: 0,
    freezeGranted: 0,
    ...overrides,
  };
}

function goal(overrides: Partial<Goal>): Goal {
  return { id: "g1", trackableId: "t1", targetCount: 10, startsOn: "2026-01-01", endsOn: "2026-01-14", ...overrides };
}

describe("goalStatus", () => {
  it("is upcoming before startsOn, with zero progress/daysElapsed", () => {
    const g = goal({ startsOn: "2026-02-01", endsOn: "2026-02-14" });
    const s = goalStatus(g, [], "2026-01-10");
    expect(s.state).toBe("upcoming");
    expect(s.progress).toBe(0);
    expect(s.daysElapsed).toBe(0);
  });

  it("is active and on pace when progress meets the expected fraction", () => {
    const g = goal({ targetCount: 10, startsOn: "2026-01-01", endsOn: "2026-01-14" }); // 14 days total
    const completions = Array.from({ length: 6 }, (_, i) => completion({ completedOn: `2026-01-0${i + 1}` }));
    const s = goalStatus(g, completions, "2026-01-08"); // day 8 of 14 -> expected 10*8/14 ~= 5.71
    expect(s.state).toBe("active");
    expect(s.progress).toBe(6);
    expect(s.daysTotal).toBe(14);
    expect(s.daysElapsed).toBe(8);
    expect(s.onPace).toBe(true);
  });

  it("is active but behind pace when progress falls short of the expected fraction", () => {
    const g = goal({ targetCount: 10, startsOn: "2026-01-01", endsOn: "2026-01-14" });
    const completions = [completion({ completedOn: "2026-01-01" }), completion({ completedOn: "2026-01-02" }), completion({ completedOn: "2026-01-03" })];
    const s = goalStatus(g, completions, "2026-01-08"); // expected ~5.71, only 3 done
    expect(s.state).toBe("active");
    expect(s.onPace).toBe(false);
  });

  it("is met the moment progress reaches the target, even mid-window", () => {
    const g = goal({ targetCount: 5, startsOn: "2026-01-01", endsOn: "2026-02-11" }); // 6-week window
    const completions = Array.from({ length: 5 }, (_, i) => completion({ completedOn: `2026-01-0${i + 1}` }));
    const s = goalStatus(g, completions, "2026-01-10"); // well before the window ends
    expect(s.state).toBe("met");
  });

  it("is missed once today is past endsOn and the target was never reached", () => {
    const g = goal({ targetCount: 10, startsOn: "2026-01-01", endsOn: "2026-01-14" });
    const completions = Array.from({ length: 4 }, (_, i) => completion({ completedOn: `2026-01-0${i + 1}` }));
    const s = goalStatus(g, completions, "2026-01-20");
    expect(s.state).toBe("missed");
  });

  it("is still active (not missed) exactly on endsOn — the window end is inclusive", () => {
    const g = goal({ targetCount: 10, startsOn: "2026-01-01", endsOn: "2026-01-14" });
    const completions = Array.from({ length: 4 }, (_, i) => completion({ completedOn: `2026-01-0${i + 1}` }));
    const s = goalStatus(g, completions, "2026-01-14");
    expect(s.state).toBe("active");
  });
});

describe("maxAchievableInWindow", () => {
  it("counts every day for an unrestricted day-period habit", () => {
    const t = { period: "day" as const, weekdays: null, quota: 1 };
    expect(maxAchievableInWindow(t, "2026-01-01", "2026-01-14")).toBe(14);
  });

  it("counts only the scheduled weekdays for a specific-weekday habit", () => {
    const t = { period: "day" as const, weekdays: [1, 3, 5], quota: 1 }; // Mon/Wed/Fri
    // 2026-01-01 is a Thursday; the 14-day window 01-01..01-14 contains Mon/Wed/Fri on 01-02,05,07,09,12,14 = 6
    expect(maxAchievableInWindow(t, "2026-01-01", "2026-01-14")).toBe(6);
  });

  it("multiplies periods-in-window by quota for a week-period habit", () => {
    const t = { period: "week" as const, weekdays: null, quota: 3 };
    // a 14-day window spans 2 ISO weeks at most -> ceil(14/7)*3 = 6
    expect(maxAchievableInWindow(t, "2026-01-01", "2026-01-14")).toBe(6);
  });
});
