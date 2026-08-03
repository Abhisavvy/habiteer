import { describe, it, expect } from "vitest";
import { notificationRequestsFor, parseTime } from "../schedule";
import type { Trackable } from "@/features/trackables/api";

function trackable(overrides: Partial<Trackable>): Trackable {
  return {
    id: "id",
    kind: "habit",
    name: "Drink water",
    emoji: "💧",
    difficulty: "easy",
    coinValue: 10,
    goalType: "build",
    period: "day",
    quota: 1,
    weekdays: null,
    dueOn: null,
    reminderTime: "09:00",
    why: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("parseTime", () => {
  it("parses a valid HH:MM", () => {
    expect(parseTime("09:05")).toEqual({ hour: 9, minute: 5 });
    expect(parseTime("23:59")).toEqual({ hour: 23, minute: 59 });
  });
  it("rejects malformed or out-of-range times", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("9:00")).toBeNull(); // needs zero-padded hour
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
});

describe("notificationRequestsFor", () => {
  const now = new Date("2026-01-05T08:00:00"); // Monday 08:00 local

  it("returns nothing when reminderTime is null", () => {
    expect(notificationRequestsFor(trackable({ reminderTime: null }), now)).toEqual([]);
  });

  it("returns nothing when reminderTime is malformed", () => {
    expect(notificationRequestsFor(trackable({ reminderTime: "9am" }), now)).toEqual([]);
  });

  it("schedules one daily trigger for a plain daily habit", () => {
    const reqs = notificationRequestsFor(trackable({ weekdays: null, period: "day", reminderTime: "09:00" }), now);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].trigger).toEqual({ type: "daily", hour: 9, minute: 0 });
    expect(reqs[0].identifier).toBe("id:0");
  });

  it("schedules one weekly trigger per scheduled weekday (0=Sun mapped to expo 1=Sun)", () => {
    const reqs = notificationRequestsFor(trackable({ weekdays: [1, 3, 5], period: "day", reminderTime: "18:30" }), now);
    expect(reqs).toHaveLength(3);
    // our 1=Mon,3=Wed,5=Fri -> expo weekday +1 = 2,4,6
    expect(reqs.map((r) => r.trigger)).toEqual([
      { type: "weekly", weekday: 2, hour: 18, minute: 30 },
      { type: "weekly", weekday: 4, hour: 18, minute: 30 },
      { type: "weekly", weekday: 6, hour: 18, minute: 30 },
    ]);
    expect(reqs.map((r) => r.identifier)).toEqual(["id:0", "id:1", "id:2"]);
  });

  it("schedules a daily nudge for a week-quota habit", () => {
    const reqs = notificationRequestsFor(trackable({ period: "week", quota: 3, weekdays: null, reminderTime: "07:15" }), now);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].trigger).toEqual({ type: "daily", hour: 7, minute: 15 });
  });

  it("schedules a one-off date trigger for a future-dated task", () => {
    const task = trackable({ kind: "task", period: null, weekdays: null, dueOn: "2026-01-10", reminderTime: "09:00" });
    const reqs = notificationRequestsFor(task, now);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].trigger).toEqual({ type: "date", date: "2026-01-10T09:00:00" });
  });

  it("skips a task whose reminder instant is already past", () => {
    const task = trackable({ kind: "task", period: null, weekdays: null, dueOn: "2026-01-05", reminderTime: "07:00" });
    // now is 2026-01-05T08:00 — the 07:00 slot already passed today
    expect(notificationRequestsFor(task, now)).toEqual([]);
  });

  it("gives an anytime task (no dueOn) no reminder even if a time is set", () => {
    const task = trackable({ kind: "task", period: null, weekdays: null, dueOn: null, reminderTime: "09:00" });
    expect(notificationRequestsFor(task, now)).toEqual([]);
  });

  it("uses build framing for a build habit and reduce framing for a reduce habit", () => {
    const build = notificationRequestsFor(trackable({ goalType: "build", reminderTime: "09:00" }), now)[0];
    const reduce = notificationRequestsFor(trackable({ goalType: "reduce", reminderTime: "09:00" }), now)[0];
    expect(build.body.toLowerCase()).toContain("streak");
    expect(reduce.body.toLowerCase()).toContain("resist");
    // both surface the trackable name/emoji in the title
    expect(build.title).toContain("Drink water");
  });
});
