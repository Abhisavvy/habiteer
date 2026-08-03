import { currentStreak, periodProgress } from "@/features/gamification/streak";
import { comboMultiplier } from "@/features/gamification/combo";
import { levelInfo } from "@/features/gamification/xp";
import { daysBetween, type ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "./api";

export type TrackableStatus = {
  streak: number;
  isDoneToday: boolean;
  combo: number;
  periodProgress?: { completed: number; quota: number };
};

export function trackableStatus(trackable: Trackable, completions: Completion[], today: ISODate): TrackableStatus {
  const dates = completions.filter((c) => c.trackableId === trackable.id).map((c) => c.completedOn);
  const isDoneToday = dates.includes(today);
  const isRecurrence = trackable.period === "week" || trackable.period === "month";
  const streak =
    trackable.kind === "habit"
      ? currentStreak(
          dates,
          { weekdays: trackable.weekdays ?? undefined, period: trackable.period ?? undefined, quota: trackable.quota },
          today
        )
      : 0;
  return {
    streak,
    isDoneToday,
    combo: comboMultiplier(streak),
    periodProgress: isRecurrence ? periodProgress(dates, trackable.period as "week" | "month", trackable.quota, today) : undefined,
  };
}

export type OverallProgress = { totalXp: number; level: number; intoLevel: number; need: number };

export function overallProgress(completions: Completion[]): OverallProgress {
  const totalXp = completions.reduce((sum, c) => sum + c.xpEarned, 0);
  const { level, intoLevel, need } = levelInfo(totalXp);
  return { totalXp, level, intoLevel, need };
}

/** Days since the most recent completion across ALL trackables — `null` for
 * an account with no completions ever (a brand-new user is not "lapsed",
 * explicit guard rather than defaulting to a number that would read as one). */
export function daysSinceLastActivity(completions: Completion[], today: ISODate): number | null {
  if (completions.length === 0) return null;
  const lastDate = completions.reduce((max, c) => (c.completedOn > max ? c.completedOn : max), completions[0].completedOn);
  return daysBetween(lastDate, today);
}
