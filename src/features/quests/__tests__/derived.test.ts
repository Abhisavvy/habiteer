import { describe, it, expect } from "vitest";
import { questMetricValue, questStatus, activeQuestStatuses, featuredQuestStatus } from "../derived";
import type { QuestDef } from "@/features/gamification/constants";
import type { Completion } from "@/features/completions/api";

function comp(overrides: Partial<Completion>): Completion {
  return {
    id: Math.random().toString(36).slice(2),
    trackableId: "t1",
    completedOn: "2026-01-06",
    xpEarned: 10,
    coinsEarned: 10,
    streakAfter: 1,
    freezeSpent: 0,
    freezeGranted: 0,
    ...overrides,
  };
}

// ISO week of 2026-01-08 (Thu) starts Mon 2026-01-05.
const TODAY = "2026-01-08";
const WEEK_START = "2026-01-05";

describe("questMetricValue", () => {
  const thisWeek = [
    comp({ completedOn: "2026-01-05", coinsEarned: 30 }),
    comp({ completedOn: "2026-01-05", coinsEarned: 20 }), // same day
    comp({ completedOn: "2026-01-08", coinsEarned: 50 }),
  ];
  const lastWeek = [comp({ completedOn: "2026-01-04", coinsEarned: 999 })]; // before week start — excluded
  const all = [...thisWeek, ...lastWeek];

  it("counts completions this week only", () => {
    expect(questMetricValue("completions", all, WEEK_START)).toBe(3);
  });
  it("counts distinct active days this week", () => {
    expect(questMetricValue("active_days", all, WEEK_START)).toBe(2); // 01-05, 01-08
  });
  it("sums coins earned this week only", () => {
    expect(questMetricValue("coins_earned", all, WEEK_START)).toBe(100); // 30+20+50, not the 999
  });
});

describe("questStatus", () => {
  const quest: QuestDef = { id: "q", metric: "completions", goal: 3, reward: 40 };

  it("reports met once progress reaches the goal", () => {
    const completions = [comp({ completedOn: "2026-01-06" }), comp({ completedOn: "2026-01-07" }), comp({ completedOn: "2026-01-08" })];
    const s = questStatus(quest, completions, TODAY);
    expect(s.progress).toBe(3);
    expect(s.met).toBe(true);
    expect(s.active).toBe(true);
  });

  it("is not met below the goal", () => {
    const s = questStatus(quest, [comp({ completedOn: "2026-01-06" })], TODAY);
    expect(s.met).toBe(false);
    expect(s.progress).toBe(1);
  });

  it("marks an event quest inactive outside its window", () => {
    const event: QuestDef = { ...quest, id: "ev", activeFrom: "2026-02-01", activeUntil: "2026-02-07" };
    expect(questStatus(event, [], TODAY).active).toBe(false);
  });

  it("marks an event quest active inside its window", () => {
    const event: QuestDef = { ...quest, id: "ev", activeFrom: "2026-01-05", activeUntil: "2026-01-11" };
    expect(questStatus(event, [], TODAY).active).toBe(true);
  });
});

describe("activeQuestStatuses", () => {
  it("excludes quests whose event window doesn't include today", () => {
    const statuses = activeQuestStatuses([], "2026-07-23"); // weekend_warrior window covers this
    const ids = statuses.map((s) => s.quest.id);
    expect(ids).toContain("busy_bee"); // always-on
    expect(ids).toContain("weekend_warrior"); // window 07-20..07-27 includes 07-23
  });

  it("hides the event quest outside its window", () => {
    const statuses = activeQuestStatuses([], "2026-09-01");
    expect(statuses.map((s) => s.quest.id)).not.toContain("weekend_warrior");
    expect(statuses.map((s) => s.quest.id)).toContain("busy_bee");
  });
});

describe("featuredQuestStatus", () => {
  // TODAY/WEEK_START (defined above) are outside weekend_warrior's window
  // (2026-07-20..27), so only busy_bee (goal 15), steady (goal 5
  // active_days), coin_rush (goal 200 coins) are ever active here.

  it("features an unclaimed quest that's already met, over one still in progress", () => {
    // Piled on one day: meets busy_bee (15 completions) but NOT steady
    // (only 1 distinct active day) — unambiguous which one is "met".
    const completions = Array.from({ length: 15 }, () => comp({ completedOn: "2026-01-06", coinsEarned: 1 }));
    const featured = featuredQuestStatus(completions, [], TODAY);
    expect(featured?.quest.id).toBe("busy_bee");
    expect(featured?.met).toBe(true);
    expect(featured?.claimed).toBe(false);
  });

  it("skips a met-but-already-claimed quest, featuring the next best instead", () => {
    const completions = Array.from({ length: 15 }, () => comp({ completedOn: "2026-01-06", coinsEarned: 1 }));
    const featured = featuredQuestStatus(completions, [{ questId: "busy_bee", week: WEEK_START }], TODAY);
    expect(featured?.quest.id).not.toBe("busy_bee");
  });

  it("features the active quest closest to its own goal when none are met", () => {
    // steady: 3 distinct active days / 5 goal = 0.6. coin_rush: 40/200 = 0.2. busy_bee: 3/15 = 0.2.
    const completions = [
      comp({ completedOn: "2026-01-05", coinsEarned: 20 }),
      comp({ completedOn: "2026-01-06", coinsEarned: 20 }),
      comp({ completedOn: "2026-01-07", coinsEarned: 0 }),
    ];
    const featured = featuredQuestStatus(completions, [], TODAY);
    expect(featured?.quest.id).toBe("steady");
    expect(featured?.met).toBe(false);
  });
});
