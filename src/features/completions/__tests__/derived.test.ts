import { describe, it, expect } from "vitest";
import { trackableStatus, overallProgress, daysSinceLastActivity } from "../derived";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "../api";

function trackable(overrides: Partial<Trackable>): Trackable {
  return {
    id: "t1",
    kind: "habit",
    name: "test",
    emoji: "🎯",
    difficulty: "easy",
    coinValue: 10,
    goalType: "build",
    dueOn: null,
    reminderTime: null,
    why: null,
    period: "day",
    quota: 1,
    weekdays: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

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

describe("trackableStatus", () => {
  it("computes streak and isDoneToday for a habit completed today", () => {
    const t = trackable({ id: "t1" });
    const completions = [
      completion({ trackableId: "t1", completedOn: "2026-01-08" }),
      completion({ trackableId: "t1", completedOn: "2026-01-09" }),
      completion({ trackableId: "t1", completedOn: "2026-01-10" }),
    ];
    const status = trackableStatus(t, completions, "2026-01-10");
    expect(status.streak).toBe(3);
    expect(status.isDoneToday).toBe(true);
    expect(status.combo).toBe(1.2);
  });

  it("ignores other trackables' completions", () => {
    const t = trackable({ id: "t1" });
    const completions = [completion({ trackableId: "other", completedOn: "2026-01-10" })];
    const status = trackableStatus(t, completions, "2026-01-10");
    expect(status.streak).toBe(0);
    expect(status.isDoneToday).toBe(false);
  });

  it("always reports streak 0 for tasks", () => {
    const t = trackable({ id: "t1", kind: "task" });
    const completions = [completion({ trackableId: "t1", completedOn: "2026-01-10" })];
    const status = trackableStatus(t, completions, "2026-01-10");
    expect(status.streak).toBe(0);
  });

  it("reports periodProgress for a week-quota habit, omits it for day habits", () => {
    const weekly = trackable({ id: "t1", period: "week", quota: 3 });
    const completions = [
      completion({ trackableId: "t1", completedOn: "2025-12-30" }), // previous ISO week — doesn't count
      completion({ trackableId: "t1", completedOn: "2026-01-05" }), // Mon, same ISO week as 01-07
    ];
    expect(trackableStatus(weekly, completions, "2026-01-07").periodProgress).toEqual({ completed: 1, quota: 3 });

    const daily = trackable({ id: "t1" });
    expect(trackableStatus(daily, completions, "2026-01-07").periodProgress).toBeUndefined();
  });
});

describe("overallProgress", () => {
  it("sums XP across all completions and derives level", () => {
    const completions = [completion({ xpEarned: 60 }), completion({ xpEarned: 40 })];
    const progress = overallProgress(completions);
    expect(progress.totalXp).toBe(100);
    expect(progress.level).toBe(2);
    expect(progress.intoLevel).toBe(0);
  });
});

describe("daysSinceLastActivity", () => {
  it("is null for an account with no completions ever — not lapsed, just new", () => {
    expect(daysSinceLastActivity([], "2026-01-10")).toBeNull();
  });

  it("is 0 when the most recent completion was today", () => {
    const completions = [completion({ completedOn: "2026-01-08" }), completion({ completedOn: "2026-01-10" })];
    expect(daysSinceLastActivity(completions, "2026-01-10")).toBe(0);
  });

  it("counts days since the most recent completion across all trackables", () => {
    const completions = [
      completion({ trackableId: "a", completedOn: "2026-01-01" }),
      completion({ trackableId: "b", completedOn: "2026-01-05" }),
    ];
    expect(daysSinceLastActivity(completions, "2026-01-10")).toBe(5);
  });
});
