import { describe, it, expect } from "vitest";
import { habitStats, coinsPerWeek, bestStreakHabit } from "../derived";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "@/features/completions/api";

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

const TODAY = "2026-01-10"; // Saturday

describe("habitStats", () => {
  it("computes completion rate for a daily habit with some missed days", () => {
    const habit = trackable({ id: "daily", createdAt: "2026-01-05T00:00:00Z" }); // 6 scheduled days through 01-10
    const completions = [
      completion({ trackableId: "daily", completedOn: "2026-01-05" }),
      completion({ trackableId: "daily", completedOn: "2026-01-06" }),
      completion({ trackableId: "daily", completedOn: "2026-01-08" }),
    ];
    const stats = habitStats(habit, completions, TODAY);
    expect(stats.scheduled).toBe(6);
    expect(stats.completed).toBe(3);
    expect(stats.completionRate).toBeCloseTo(0.5);
  });

  it("only counts matching weekdays as scheduled for a weekday-scheduled habit", () => {
    // Mon(1)/Wed(3)/Fri(5) only, 2026-01-05 (Mon) through 2026-01-10 (Sat): Mon 5, Wed 7, Fri 9 = 3 scheduled
    const habit = trackable({ id: "mwf", weekdays: [1, 3, 5], createdAt: "2026-01-05T00:00:00Z" });
    const completions = [completion({ trackableId: "mwf", completedOn: "2026-01-05" })];
    const stats = habitStats(habit, completions, TODAY);
    expect(stats.scheduled).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.completionRate).toBeCloseTo(1 / 3);
  });

  it("leaves completionRate undefined for a week/month-period habit", () => {
    const habit = trackable({ id: "weekly", period: "week", quota: 3, weekdays: null });
    const stats = habitStats(habit, [], TODAY);
    expect(stats.completionRate).toBeUndefined();
    expect(stats.scheduled).toBeUndefined();
  });

  it("sums coinsEarned across all completions for the habit", () => {
    const habit = trackable({ id: "daily" });
    const completions = [
      completion({ trackableId: "daily", completedOn: "2026-01-05", coinsEarned: 20 }),
      completion({ trackableId: "daily", completedOn: "2026-01-06", coinsEarned: 15 }),
      completion({ trackableId: "other", completedOn: "2026-01-06", coinsEarned: 999 }),
    ];
    const stats = habitStats(habit, completions, TODAY);
    expect(stats.coinsEarned).toBe(35);
  });
});

describe("coinsPerWeek", () => {
  it("buckets coins by week, across a week boundary", () => {
    // 2026-01-10 is a Saturday; its week starts Monday 2026-01-05.
    // 2026-01-04 (Sunday) belongs to the prior week (starts 2025-12-29).
    const completions = [
      completion({ completedOn: "2026-01-05", coinsEarned: 10 }),
      completion({ completedOn: "2026-01-08", coinsEarned: 5 }),
      completion({ completedOn: "2026-01-04", coinsEarned: 7 }),
    ];
    const buckets = coinsPerWeek(completions, TODAY, 2);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toEqual({ weekStart: "2025-12-29", coins: 7 });
    expect(buckets[1]).toEqual({ weekStart: "2026-01-05", coins: 15 });
  });

  it("returns zero-coin buckets for weeks with no completions", () => {
    const buckets = coinsPerWeek([], TODAY, 3);
    expect(buckets.every((b) => b.coins === 0)).toBe(true);
    expect(buckets).toHaveLength(3);
  });
});

describe("bestStreakHabit", () => {
  it("picks the habit with the longest all-time streak among several", () => {
    const habits = [
      trackable({ id: "a", name: "Short", createdAt: "2026-01-01T00:00:00Z" }),
      trackable({ id: "b", name: "Long", createdAt: "2026-01-01T00:00:00Z" }),
    ];
    const completions = [
      completion({ trackableId: "a", completedOn: "2026-01-09" }),
      completion({ trackableId: "b", completedOn: "2026-01-07" }),
      completion({ trackableId: "b", completedOn: "2026-01-08" }),
      completion({ trackableId: "b", completedOn: "2026-01-09" }),
    ];
    const best = bestStreakHabit(habits, completions, TODAY);
    expect(best?.trackableId).toBe("b");
    expect(best?.streak).toBe(3);
  });

  it("returns null when no habit has any completions", () => {
    const habits = [trackable({ id: "a" })];
    expect(bestStreakHabit(habits, [], TODAY)).toBeNull();
  });
});
