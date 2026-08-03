import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { filterDueToday, today } from "../today";
import type { Trackable } from "../api";

function trackable(overrides: Partial<Trackable>): Trackable {
  return {
    id: "id",
    kind: "habit",
    name: "test",
    emoji: "🎯",
    difficulty: "easy",
    coinValue: 10,
    goalType: "build",
    period: "day",
    quota: 1,
    weekdays: null,
    dueOn: null,
    reminderTime: null,
    why: null,
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

  it("always includes an unscheduled task (dueOn null) regardless of weekday", () => {
    const task = trackable({ id: "task", kind: "task", weekdays: null, period: null, dueOn: null });
    expect(filterDueToday([task], "2026-01-06")).toContainEqual(task);
  });

  it("hides a future-dated task until its scheduled day, then shows it (including overdue)", () => {
    const task = trackable({ id: "sched", kind: "task", period: null, dueOn: "2026-01-10" });
    expect(filterDueToday([task], "2026-01-08")).not.toContainEqual(task); // before: hidden
    expect(filterDueToday([task], "2026-01-10")).toContainEqual(task); // on the day: shown
    expect(filterDueToday([task], "2026-01-12")).toContainEqual(task); // after (overdue, not done): still shown
  });

  it("always includes week/month-quota habits regardless of weekday", () => {
    const weekly = trackable({ id: "weekly", period: "week", quota: 3, weekdays: null });
    const monthly = trackable({ id: "monthly", period: "month", quota: 1, weekdays: null });
    expect(filterDueToday([weekly, monthly], "2026-01-06")).toEqual([weekly, monthly]);
  });
});

describe("today", () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    // IST is UTC+5:30 — local midnight rolls over ~5.5h before the UTC day does,
    // the exact window where a local-device date would drift from the server's
    // UTC-anchored current_app_date().
    process.env.TZ = "Asia/Kolkata";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTZ;
  });

  it("stays anchored to UTC's calendar date, not the device's local date", () => {
    // 2026-07-22T20:00:00Z is already 2026-07-23 01:30 local in IST.
    vi.setSystemTime(new Date("2026-07-22T20:00:00.000Z"));
    expect(today()).toBe("2026-07-22");
  });
});
