import { describe, it, expect } from "vitest";
import {
  goalStatus,
  maxAchievableInWindow,
  checkpointThreshold,
  checkpointPayoutTotal,
  completionBonus,
  pledgeView,
  type Goal,
} from "../derived";
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
  return {
    id: "g1",
    trackableId: "t1",
    targetCount: 10,
    startsOn: "2026-01-01",
    endsOn: "2026-01-14",
    stakedCoins: 40,
    state: "active",
    checkpointsBanked: 0,
    ...overrides,
  };
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

  it("is on pace on day one, before a single completion is even due", () => {
    // target 12 over 28 days means expected progress after day 1 is 0.43, and
    // a strict `progress >= expected` made a brand-new pledge read "behind
    // pace" the moment it was created. You cannot be behind by a fraction of a
    // completion — progress is whole numbers.
    const g = goal({ targetCount: 12, startsOn: "2026-01-01", endsOn: "2026-01-28" });
    const s = goalStatus(g, [], "2026-01-01");
    expect(s.state).toBe("active");
    expect(s.onPace).toBe(true);
  });

  it("is behind pace only once a whole completion has been missed", () => {
    // Day 8 of 28 at target 12 -> expected 3.43. At 3 done you are within the
    // same completion, so still on pace; at 2 you have genuinely dropped one.
    const g = goal({ targetCount: 12, startsOn: "2026-01-01", endsOn: "2026-01-28" });
    const three = Array.from({ length: 3 }, (_, i) => completion({ completedOn: `2026-01-0${i + 1}` }));
    expect(goalStatus(g, three, "2026-01-08").onPace).toBe(true);
    expect(goalStatus(g, three.slice(0, 2), "2026-01-08").onPace).toBe(false);
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

describe("checkpointThreshold", () => {
  it("splits a target into COUNT rising thresholds, the last being the target", () => {
    // target 20, 4 checkpoints -> 5, 10, 15, 20
    expect([1, 2, 3, 4].map((i) => checkpointThreshold(20, i))).toEqual([5, 10, 15, 20]);
  });

  it("rounds UP so a non-divisible target never lets the last checkpoint land early", () => {
    // target 10 -> ceil(2.5)=3, ceil(5)=5, ceil(7.5)=8, ceil(10)=10.
    // The SQL mirror must use `/ 4.0`; integer division would give 2,5,7,10
    // and pay the first checkpoint a completion early.
    expect([1, 2, 3, 4].map((i) => checkpointThreshold(10, i))).toEqual([3, 5, 8, 10]);
  });

  it("always ends exactly on the target", () => {
    for (const target of [8, 9, 13, 17, 20, 31, 100]) {
      expect(checkpointThreshold(target, 4)).toBe(target);
    }
  });
});

describe("checkpointPayoutTotal / conservation", () => {
  it("pays out exactly the stake once all checkpoints are banked, for every stake", () => {
    // The whole point: banking all four returns the stake precisely — no coins
    // created, none destroyed, regardless of divisibility.
    for (const stake of [10, 11, 13, 25, 50, 99, 100, 137]) {
      expect(checkpointPayoutTotal(stake, 4)).toBe(stake);
    }
  });

  it("splits 50 as 12/12/12/14 — the last checkpoint trues up the remainder", () => {
    const per = [1, 2, 3, 4].map((n) => checkpointPayoutTotal(50, n) - checkpointPayoutTotal(50, n - 1));
    expect(per).toEqual([12, 12, 12, 14]);
    expect(per.reduce((a, b) => a + b, 0)).toBe(50);
  });

  it("banks nothing at zero checkpoints", () => {
    expect(checkpointPayoutTotal(50, 0)).toBe(0);
  });

  it("is cumulative, so banking several at once equals banking them one by one", () => {
    // Guards the multi-checkpoint path: payout = total(n) - total(banked).
    const jumpStraightToThree = checkpointPayoutTotal(37, 3) - checkpointPayoutTotal(37, 0);
    const oneAtATime =
      (checkpointPayoutTotal(37, 1) - checkpointPayoutTotal(37, 0)) +
      (checkpointPayoutTotal(37, 2) - checkpointPayoutTotal(37, 1)) +
      (checkpointPayoutTotal(37, 3) - checkpointPayoutTotal(37, 2));
    expect(jumpStraightToThree).toBe(oneAtATime);
  });
});

describe("completionBonus", () => {
  it("is half the stake at the default 50% rate", () => {
    expect(completionBonus(50)).toBe(25);
    expect(completionBonus(10)).toBe(5);
  });

  it("rounds a fractional bonus to a whole coin", () => {
    expect(completionBonus(11)).toBe(6); // 5.5 -> 6
    expect(completionBonus(13)).toBe(7); // 6.5 -> 7
  });
});

describe("pledgeView", () => {
  it("reports nothing bankable before the first checkpoint", () => {
    // target 8 → thresholds 2,4,6,8. One completion clears none of them.
    const v = pledgeView(goal({ targetCount: 8, stakedCoins: 40 }), 1);
    expect(v.earnedCheckpoints).toBe(0);
    expect(v.bankable).toBe(0);
    expect(v.pendingPayout).toBe(0);
    expect(v.atRisk).toBe(40);
  });

  it("reports one checkpoint's worth pending once its threshold is reached", () => {
    const v = pledgeView(goal({ targetCount: 8, stakedCoins: 40 }), 2);
    expect(v.earnedCheckpoints).toBe(1);
    expect(v.bankable).toBe(1);
    expect(v.pendingPayout).toBe(10); // floor(40/4)
    expect(v.atRisk).toBe(30); // the three unearned checkpoints
  });

  it("does not re-offer a checkpoint that was already banked", () => {
    const v = pledgeView(goal({ targetCount: 8, stakedCoins: 40, checkpointsBanked: 1 }), 2);
    expect(v.earnedCheckpoints).toBe(1);
    expect(v.bankable).toBe(0);
    expect(v.pendingPayout).toBe(0);
    expect(v.atRisk).toBe(30); // banked coins are safe; the rest is still at risk
  });

  it("accumulates several checkpoints reached since the last bank", () => {
    // Skipping straight from 0 banked to 3 earned must pay all three at once,
    // matching what the RPC's total(n) - total(banked) computes.
    const v = pledgeView(goal({ targetCount: 8, stakedCoins: 40, checkpointsBanked: 0 }), 6);
    expect(v.earnedCheckpoints).toBe(3);
    expect(v.bankable).toBe(3);
    expect(v.pendingPayout).toBe(30);
    expect(v.atRisk).toBe(10);
  });

  it("puts nothing at risk once the target is fully met", () => {
    const v = pledgeView(goal({ targetCount: 8, stakedCoins: 40 }), 8);
    expect(v.earnedCheckpoints).toBe(4);
    expect(v.pendingPayout).toBe(40); // the whole stake, banked in one tap
    expect(v.atRisk).toBe(0);
  });

  it("trues up an indivisible stake so the four payouts sum to exactly the stake", () => {
    // 11 coins: floor(11/4) = 2, so checkpoints 1–3 pay 2 each and the last
    // pays the 5-coin remainder. Nothing is created or destroyed.
    const g = goal({ targetCount: 8, stakedCoins: 11 });
    expect(pledgeView(g, 2).pendingPayout).toBe(2);
    expect(pledgeView(g, 6).pendingPayout).toBe(6);
    expect(pledgeView(g, 8).pendingPayout).toBe(11);
    expect(pledgeView(g, 8).atRisk).toBe(0);
  });

  it("exposes the thresholds in order for the UI's ladder", () => {
    expect(pledgeView(goal({ targetCount: 10 }), 0).thresholds).toEqual([3, 5, 8, 10]);
  });
});
