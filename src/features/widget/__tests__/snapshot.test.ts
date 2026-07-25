import { describe, it, expect } from "vitest";
import { buildWidgetSnapshot, capSnapshotRows, rowsForHeight, rowsForHeightExpanded } from "../snapshot";
import { taskCoins } from "@/features/gamification/coins";
import { overallProgress } from "@/features/completions/derived";
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
    completedOn: "2026-01-10",
    xpEarned: 10,
    coinsEarned: 10,
    streakAfter: 1,
    ...overrides,
  };
}

const TODAY = "2026-01-10";

describe("buildWidgetSnapshot", () => {
  it("includes all due-today items when under the row cap", () => {
    const trackables = [trackable({ id: "a", name: "Habit A" }), trackable({ id: "b", name: "Habit B" })];
    const snap = buildWidgetSnapshot(trackables, [], 42, TODAY, 5);
    expect(snap.items).toHaveLength(2);
    expect(snap.moreCount).toBe(0);
    expect(snap.coinBalance).toBe(42);
  });

  it("caps rows and reports how many more are hidden", () => {
    const trackables = [
      trackable({ id: "a" }),
      trackable({ id: "b" }),
      trackable({ id: "c" }),
      trackable({ id: "d" }),
    ];
    const snap = buildWidgetSnapshot(trackables, [], 0, TODAY, 2);
    expect(snap.items).toHaveLength(2);
    expect(snap.moreCount).toBe(2);
  });

  it("shows not-done items before already-done ones when capping", () => {
    const trackables = [
      trackable({ id: "done-one" }),
      trackable({ id: "not-done" }),
    ];
    const completions = [completion({ trackableId: "done-one", completedOn: TODAY })];
    const snap = buildWidgetSnapshot(trackables, completions, 0, TODAY, 1);
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].id).toBe("not-done");
    expect(snap.moreCount).toBe(1);
  });

  it("carries the per-item coin payout, matching TrackableCard's convention", () => {
    const habit = trackable({ id: "habit", kind: "habit", coinValue: 25 });
    const task = trackable({ id: "task", kind: "task", difficulty: "hard" });
    const snap = buildWidgetSnapshot([habit, task], [], 0, TODAY, 5);
    expect(snap.items.find((i) => i.id === "habit")?.payout).toBe(25);
    expect(snap.items.find((i) => i.id === "task")?.payout).toBe(taskCoins("hard"));
  });

  it("marks isDone correctly per item", () => {
    const trackables = [trackable({ id: "a" }), trackable({ id: "b" })];
    const completions = [completion({ trackableId: "a", completedOn: TODAY })];
    const snap = buildWidgetSnapshot(trackables, completions, 0, TODAY, 5);
    const a = snap.items.find((i) => i.id === "a");
    const b = snap.items.find((i) => i.id === "b");
    expect(a?.isDone).toBe(true);
    expect(b?.isDone).toBe(false);
  });

  it("counts done/total due today for the header, over all due items (not just visible rows)", () => {
    const trackables = [trackable({ id: "a" }), trackable({ id: "b" }), trackable({ id: "c" })];
    const completions = [completion({ trackableId: "a", completedOn: TODAY })];
    const snap = buildWidgetSnapshot(trackables, completions, 0, TODAY, 1); // cap to 1 visible row
    expect(snap.doneToday).toBe(1);
    expect(snap.totalDue).toBe(3);
  });

  it("computes level/intoLevel/need from the same overallProgress every other screen uses", () => {
    const trackables = [trackable({ id: "a" })];
    const completions = [
      completion({ id: "c1", completedOn: "2026-01-08", xpEarned: 10 }),
      completion({ id: "c2", completedOn: "2026-01-09", xpEarned: 10 }),
      completion({ id: "c3", completedOn: TODAY, xpEarned: 10 }),
    ];
    const snap = buildWidgetSnapshot(trackables, completions, 0, TODAY, 5);
    const expected = overallProgress(completions);
    expect(snap.level).toBe(expected.level);
    expect(snap.intoLevel).toBe(expected.intoLevel);
    expect(snap.need).toBe(expected.need);
  });

  it("defaults displayName to empty string, and carries a given one through for the Daily strip widget", () => {
    const trackables = [trackable({ id: "a" })];
    expect(buildWidgetSnapshot(trackables, [], 0, TODAY, 5).displayName).toBe("");
    expect(buildWidgetSnapshot(trackables, [], 0, TODAY, 5, "Alex").displayName).toBe("Alex");
  });

  it("computes topStreak across habits, ignoring tasks (which never have a streak)", () => {
    const trackables = [
      trackable({ id: "a", createdAt: "2025-01-01T00:00:00Z" }),
      trackable({ id: "b", kind: "task", createdAt: "2025-01-01T00:00:00Z" }),
    ];
    const completions = [
      completion({ trackableId: "a", completedOn: "2026-01-08" }),
      completion({ trackableId: "a", completedOn: "2026-01-09" }),
      completion({ trackableId: "a", completedOn: TODAY }),
    ];
    const snap = buildWidgetSnapshot(trackables, completions, 0, TODAY, 5);
    expect(snap.topStreak).toBe(3);
  });
});

describe("capSnapshotRows", () => {
  it("re-caps to fewer rows and accumulates moreCount", () => {
    const trackables = [trackable({ id: "a" }), trackable({ id: "b" }), trackable({ id: "c" })];
    const snap = buildWidgetSnapshot(trackables, [], 0, TODAY, 20); // persisted, generous cap
    expect(snap.moreCount).toBe(0);

    const recapped = capSnapshotRows(snap, 1);
    expect(recapped.items).toHaveLength(1);
    expect(recapped.moreCount).toBe(2);
  });

  it("is a no-op when already within the row limit", () => {
    const trackables = [trackable({ id: "a" })];
    const snap = buildWidgetSnapshot(trackables, [], 0, TODAY, 20);
    expect(capSnapshotRows(snap, 4)).toEqual(snap);
  });
});

// Chrome constants below are TODAY_BANNER_HEIGHT(44)/DAILY_STRIP_BANNER_HEIGHT(64)
// + body padding + a small margin (see snapshot.ts) — the P2 banner redesign
// made both widgets' fixed chrome shorter than the pre-banner layout (a
// separate divider + two-line subtitle + below-header progress bar), so
// more rows now fit at the same widget height than before that redesign.
describe("rowsForHeight", () => {
  it("shows more rows for a taller widget", () => {
    expect(rowsForHeight(80)).toBe(1);
    expect(rowsForHeight(150)).toBe(2);
    expect(rowsForHeight(220)).toBe(4);
    expect(rowsForHeight(300)).toBe(6);
  });
});

describe("rowsForHeightExpanded", () => {
  it("shows fewer rows than the compact widget at the same height (taller chrome)", () => {
    expect(rowsForHeightExpanded(80)).toBe(1);
    expect(rowsForHeightExpanded(150)).toBe(1);
    expect(rowsForHeightExpanded(220)).toBe(3);
    expect(rowsForHeightExpanded(300)).toBe(6);
  });
});
