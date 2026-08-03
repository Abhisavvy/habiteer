import { daysBetween, nextDay, weekday, type ISODate } from "@/features/gamification/dates";
import type { Completion } from "@/features/completions/api";
import type { Goal } from "./api";

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
