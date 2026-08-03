import { daysBetween, nextDay, weekday, type ISODate } from "@/features/gamification/dates";
import { GOAL_CHECKPOINT_COUNT, GOAL_BONUS_PCT } from "@/features/gamification/constants";
import type { Completion } from "@/features/completions/api";
import type { Goal } from "./api";

/**
 * Completions needed to reach checkpoint `i` (1-based) of a pledge.
 *
 * Rounds UP, and the SQL mirror MUST be written `ceil(target * i / 4.0)` — in
 * Postgres `target * i / 4` is integer division that truncates BEFORE `ceil`
 * ever runs, making `ceil` a no-op. For target 10 that would give thresholds
 * 2,5,7,10 instead of 3,5,8,10, i.e. the server paying the first checkpoint a
 * completion earlier than the UI promised.
 */
export function checkpointThreshold(targetCount: number, i: number): number {
  return Math.ceil((targetCount * i) / GOAL_CHECKPOINT_COUNT);
}

/**
 * CUMULATIVE stake returned after banking `n` checkpoints. Deliberately
 * cumulative rather than per-checkpoint: an actual payout is always
 * `total(n) - total(alreadyBanked)`, so banking three checkpoints in one call
 * can never drift from banking them one at a time.
 *
 * The final checkpoint trues up the remainder, so the four payouts sum to
 * EXACTLY the stake for any integer stake — no coins created or destroyed
 * (stake 50 → 12, 12, 12, 14).
 */
export function checkpointPayoutTotal(stakedCoins: number, n: number): number {
  if (n <= 0) return 0;
  if (n >= GOAL_CHECKPOINT_COUNT) return stakedCoins;
  return n * Math.floor(stakedCoins / GOAL_CHECKPOINT_COUNT);
}

/** Bonus paid on top of the returned stake for completing the pledge. */
export function completionBonus(stakedCoins: number): number {
  return Math.round(stakedCoins * GOAL_BONUS_PCT);
}

export type PledgeView = {
  /** Highest checkpoint whose threshold the progress has cleared. */
  earnedCheckpoints: number;
  /** Earned but not yet claimed — how many a single Bank tap would settle. */
  bankable: number;
  /** Coins that Bank tap would credit. */
  pendingPayout: number;
  /** Coins that would be lost if the window closed right now. Everything
   * already banked is safe, and so is everything earned-but-unbanked, because
   * settlement banks earned checkpoints before forfeiting. */
  atRisk: number;
  /** Completion counts for each checkpoint, ascending — the UI's ladder. */
  thresholds: number[];
};

/**
 * The bank/at-risk picture for one pledge, given its server-side progress.
 *
 * Mirrors what `fn_bank_goal_checkpoint` computes so the button's label agrees
 * with what the tap actually pays. The server recounts progress itself and is
 * authoritative — this exists so the UI can promise the right number, and so
 * "Bank" is hidden rather than offered-then-rejected when nothing is due.
 */
export function pledgeView(goal: Goal, progress: number): PledgeView {
  const thresholds = Array.from({ length: GOAL_CHECKPOINT_COUNT }, (_, i) =>
    checkpointThreshold(goal.targetCount, i + 1)
  );

  let earnedCheckpoints = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (progress >= thresholds[i]) earnedCheckpoints = i + 1;
  }

  const banked = goal.checkpointsBanked;
  const pendingPayout =
    checkpointPayoutTotal(goal.stakedCoins, earnedCheckpoints) - checkpointPayoutTotal(goal.stakedCoins, banked);

  return {
    earnedCheckpoints,
    bankable: Math.max(0, earnedCheckpoints - banked),
    pendingPayout: Math.max(0, pendingPayout),
    atRisk: goal.stakedCoins - checkpointPayoutTotal(goal.stakedCoins, Math.max(earnedCheckpoints, banked)),
    thresholds,
  };
}

export type { Goal } from "./api";
export type GoalState = "upcoming" | "active" | "met" | "missed";

export type GoalStatus = {
  goal: Goal;
  progress: number;
  daysElapsed: number;
  daysTotal: number;
  expectedProgress: number;
  onPace: boolean;
  state: GoalState;
};

/**
 * A goal's current pace/state — a read-only lens over completions that
 * already happened, same "derive in TS, don't compute server-side"
 * convention as `trackableStatus`/`periodProgress`/`questStatus`.
 *
 * `state` is `"met"` the instant `progress` reaches `targetCount`, even
 * before `endsOn` — same as a weekly quest can be met mid-week. `"missed"`
 * only once `today` is genuinely past `endsOn` (inclusive — `today ===
 * endsOn` is still `"active"`) and the target was never reached.
 */
export function goalStatus(goal: Goal, completions: Completion[], today: ISODate): GoalStatus {
  const progress = completions.filter(
    (c) => c.trackableId === goal.trackableId && c.completedOn >= goal.startsOn && c.completedOn <= goal.endsOn
  ).length;

  const daysTotal = daysBetween(goal.startsOn, goal.endsOn) + 1;
  const daysElapsed = Math.max(0, Math.min(daysTotal, daysBetween(goal.startsOn, today) + 1));
  const expectedProgress = daysTotal > 0 ? goal.targetCount * (daysElapsed / daysTotal) : 0;

  let state: GoalState;
  if (today < goal.startsOn) state = "upcoming";
  else if (progress >= goal.targetCount) state = "met";
  else if (today > goal.endsOn) state = "missed";
  else state = "active";

  return { goal, progress, daysElapsed, daysTotal, expectedProgress, onPace: progress >= expectedProgress, state };
}

/**
 * A rough ceiling on how many completions a habit's own schedule could
 * realistically produce within [startsOn, endsOn] — used only for a soft,
 * non-blocking warning in the goal-creation UI ("this target may not be
 * reachable"), not for `goalStatus`'s own math. Week/month periods use
 * `ceil(days / periodLength) * quota` — an upper bound, not exact (a window
 * that starts mid-period is still counted as a full period), which is fine
 * for a heads-up rather than a hard validation.
 */
export function maxAchievableInWindow(
  trackable: { period: "day" | "week" | "month" | null; weekdays: number[] | null; quota: number },
  startsOn: ISODate,
  endsOn: ISODate
): number {
  const totalDays = daysBetween(startsOn, endsOn) + 1;
  if (trackable.period === "week" || trackable.period === "month") {
    const periodDays = trackable.period === "week" ? 7 : 28;
    return Math.ceil(totalDays / periodDays) * trackable.quota;
  }
  const scheduledDays = trackable.weekdays && trackable.weekdays.length > 0 ? trackable.weekdays : null;
  let count = 0;
  let cursor = startsOn;
  for (let i = 0; i < totalDays; i++) {
    if (scheduledDays === null || scheduledDays.includes(weekday(cursor))) count += 1;
    cursor = nextDay(cursor);
  }
  return count;
}
