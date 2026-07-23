import { describe, it, expect } from "vitest";
import { groupStreak, membersDoneToday, type ActivityRow } from "../streak";

/** Build activity rows: each member active on the given days. */
function rows(map: Record<string, string[]>): ActivityRow[] {
  return Object.entries(map).flatMap(([userId, days]) => days.map((day) => ({ userId, day })));
}

const TODAY = "2026-01-10";
// prior days: 01-09, 01-08, 01-07 ...

describe("groupStreak", () => {
  it("counts consecutive days where every member showed up, including today", () => {
    const activity = rows({
      alice: ["2026-01-08", "2026-01-09", "2026-01-10"],
      bob: ["2026-01-08", "2026-01-09", "2026-01-10"],
    });
    expect(groupStreak(activity, ["alice", "bob"], TODAY)).toBe(3);
  });

  it("gives today grace: if not everyone is done today yet, the streak still holds through yesterday", () => {
    const activity = rows({
      alice: ["2026-01-08", "2026-01-09", "2026-01-10"], // alice did today
      bob: ["2026-01-08", "2026-01-09"], // bob hasn't yet today
    });
    // today isn't all-done, but grace keeps it from breaking; counts 01-09, 01-08
    expect(groupStreak(activity, ["alice", "bob"], TODAY)).toBe(2);
  });

  it("breaks on a past day a member missed", () => {
    const activity = rows({
      alice: ["2026-01-08", "2026-01-09", "2026-01-10"],
      bob: ["2026-01-09", "2026-01-10"], // bob missed 01-08
    });
    expect(groupStreak(activity, ["alice", "bob"], TODAY)).toBe(2); // 01-10, 01-09 then break at 01-08
  });

  it("is zero when today isn't all-done yet and yesterday was already missed", () => {
    const activity = rows({
      alice: ["2026-01-09", "2026-01-10"],
      bob: [], // bob hasn't shown up today (grace) and also missed yesterday
    });
    // today grace holds, but yesterday is broken -> 0
    expect(groupStreak(activity, ["alice", "bob"], TODAY)).toBe(0);
  });

  it("treats a single-member group as that member's own daily streak", () => {
    const activity = rows({ solo: ["2026-01-08", "2026-01-09", "2026-01-10"] });
    expect(groupStreak(activity, ["solo"], TODAY)).toBe(3);
  });

  it("returns 0 for no activity", () => {
    expect(groupStreak([], ["alice", "bob"], TODAY)).toBe(0);
  });

  it("ignores activity rows from non-members", () => {
    const activity = rows({
      alice: ["2026-01-09", "2026-01-10"],
      bob: ["2026-01-09", "2026-01-10"],
      stranger: ["2026-01-08"], // not in memberIds — must not affect the streak
    });
    expect(groupStreak(activity, ["alice", "bob"], TODAY)).toBe(2);
  });
});

describe("membersDoneToday", () => {
  it("reports which members have shown up today", () => {
    const activity = rows({
      alice: ["2026-01-10"],
      bob: ["2026-01-09"],
    });
    const result = membersDoneToday(activity, ["alice", "bob"], TODAY);
    expect(result).toEqual([
      { userId: "alice", done: true },
      { userId: "bob", done: false },
    ]);
  });
});
