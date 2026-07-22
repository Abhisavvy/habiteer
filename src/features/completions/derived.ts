import { currentStreak } from "@/features/gamification/streak";
import { comboMultiplier } from "@/features/gamification/combo";
import { levelInfo } from "@/features/gamification/xp";
import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "./api";

export type TrackableStatus = { streak: number; isDoneToday: boolean; combo: number };

export function trackableStatus(trackable: Trackable, completions: Completion[], today: ISODate): TrackableStatus {
  const dates = completions.filter((c) => c.trackableId === trackable.id).map((c) => c.completedOn);
  const isDoneToday = dates.includes(today);
  const streak =
    trackable.kind === "habit" ? currentStreak(dates, { weekdays: trackable.weekdays ?? undefined }, today) : 0;
  return { streak, isDoneToday, combo: comboMultiplier(streak) };
}

export type OverallProgress = { totalXp: number; level: number; intoLevel: number; need: number };

export function overallProgress(completions: Completion[]): OverallProgress {
  const totalXp = completions.reduce((sum, c) => sum + c.xpEarned, 0);
  const { level, intoLevel, need } = levelInfo(totalXp);
  return { totalXp, level, intoLevel, need };
}
