import { describe, it, expect } from "vitest";
import { filterDueToday } from "../today";
import type { Trackable } from "../api";

function trackable(overrides: Partial<Trackable>): Trackable {
  return {
    id: "id",
    kind: "habit",
    name: "test",
    emoji: "🎯",
    difficulty: "easy",
    coinValue: 10,
    period: "day",
    quota: 1,
    weekdays: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterDueToday", () => {
  it("includes a daily habit (weekdays null) every day", () => {
    const daily = trackable({ id: "daily", weekdays: null });
    expect(filterDueToday([daily], "2026-01-05")).toContainEqual(daily); // Monday
    expect(filterDueToday([daily], "2026-01-06")).toContainEqual(daily); // Tuesday
  });

  it("includes a specific-weekday habit only on scheduled days", () => {
    // 2026-01-05 Mon, 01-06 Tue, 01-07 Wed
    const mwf = trackable({ id: "mwf", weekdays: [1, 3, 5] });
    expect(filterDueToday([mwf], "2026-01-05")).toContainEqual(mwf); // Mon: scheduled
    expect(filterDueToday([mwf], "2026-01-06")).not.toContainEqual(mwf); // Tue: not scheduled
    expect(filterDueToday([mwf], "2026-01-07")).toContainEqual(mwf); // Wed: scheduled
  });

  it("always includes tasks regardless of weekday", () => {
    const task = trackable({ id: "task", kind: "task", weekdays: null, period: null });
    expect(filterDueToday([task], "2026-01-06")).toContainEqual(task);
  });

  it("always includes week/month-quota habits regardless of weekday", () => {
    const weekly = trackable({ id: "weekly", period: "week", quota: 3, weekdays: null });
    const monthly = trackable({ id: "monthly", period: "month", quota: 1, weekdays: null });
    expect(filterDueToday([weekly, monthly], "2026-01-06")).toEqual([weekly, monthly]);
  });
});
