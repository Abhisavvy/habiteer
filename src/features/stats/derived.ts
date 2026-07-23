import { currentStreak, longestStreakEver } from "@/features/gamification/streak";
import { weekday, weekStart, nextDay, prevPeriodStart, type ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "@/features/completions/api";

const MAX_LOOKBACK = 4000; // ~11 years; same safety bound as streak.ts's day-walk

export type HabitStats = {
  trackableId: string;
  currentStreak: number;
  longestStreak: number;
  coinsEarned: number;
  /** Day-period habits only — undefined for week/month period, where the
   * existing periodProgress() "N/M this {week,month}" is the correct display instead. */
  completed?: number;
  scheduled?: number;
  completionRate?: number;
};

/** Per-habit stats for the gamified stats page — completion rate, streaks,
 * lifetime coins earned. Reuses the same streak functions Profile and
 * TrackableCard already call, so this can't drift from the app's own rules. */
export function habitStats(trackable: Trackable, completions: Completion[], today: ISODate): HabitStats {
  const own = completions.filter((c) => c.trackableId === trackable.id);
  const dates = own.map((c) => c.completedOn);
  const coinsEarned = own.reduce((sum, c) => sum + c.coinsEarned, 0);

  const opts = { weekdays: trackable.weekdays ?? undefined, period: trackable.period ?? undefined, quota: trackable.quota };
  const streak = trackable.kind === "habit" ? currentStreak(dates, opts, today) : 0;
  const longest = trackable.kind === "habit" ? longestStreakEver(dates, opts, today) : 0;

  const base: HabitStats = { trackableId: trackable.id, currentStreak: streak, longestStreak: longest, coinsEarned };

  const period = trackable.period ?? "day";
  if (trackable.kind !== "habit" || period !== "day") return base;

  const done = new Set(dates);
  const scheduledDays = trackable.weekdays && trackable.weekdays.length > 0 ? trackable.weekdays : null;
  const createdDate = trackable.createdAt.slice(0, 10);

  let scheduled = 0;
  let completed = 0;
  let cursor = createdDate;
  for (let i = 0; i < MAX_LOOKBACK && cursor <= today; i++) {
    const isScheduled = scheduledDays === null || scheduledDays.includes(weekday(cursor));
    if (isScheduled) {
      scheduled += 1;
      if (done.has(cursor)) completed += 1;
    }
    cursor = nextDay(cursor);
  }

  return { ...base, completed, scheduled, completionRate: scheduled > 0 ? completed / scheduled : 0 };
}

export type WeekBucket = { weekStart: ISODate; coins: number };

/** Coins earned per week, oldest first, over the trailing `weeks` weeks — the
 * "coins earned over time" PLAN.md §11 asks for. Zero-filled for weeks with
 * no completions so the bar chart never has a gap. */
export function coinsPerWeek(completions: Completion[], today: ISODate, weeks = 8): WeekBucket[] {
  const starts: ISODate[] = [];
  let cursor = weekStart(today);
  for (let i = 0; i < weeks; i++) {
    starts.unshift(cursor);
    cursor = prevPeriodStart(cursor, "week");
  }

  const totals = new Map<ISODate, number>(starts.map((s) => [s, 0]));
  for (const c of completions) {
    const ws = weekStart(c.completedOn);
    if (totals.has(ws)) totals.set(ws, (totals.get(ws) ?? 0) + c.coinsEarned);
  }

  return starts.map((s) => ({ weekStart: s, coins: totals.get(s) ?? 0 }));
}

export type BestStreak = { trackableId: string; name: string; emoji: string; streak: number };

/** Which currently-active habit holds the longest all-time streak — the
 * "records" framing PLAN.md §11 describes ("beat your longest streak").
 * Archived habits are excluded, same accepted limitation as Profile's own
 * longest-streak calc (their old period/weekdays config isn't fetched client-side). */
export function bestStreakHabit(trackables: Trackable[], completions: Completion[], today: ISODate): BestStreak | null {
  let best: BestStreak | null = null;
  for (const t of trackables) {
    if (t.kind !== "habit") continue;
    const dates = completions.filter((c) => c.trackableId === t.id).map((c) => c.completedOn);
    if (dates.length === 0) continue;
    const streak = longestStreakEver(dates, { weekdays: t.weekdays ?? undefined, period: t.period ?? undefined, quota: t.quota }, today);
    if (!best || streak > best.streak) best = { trackableId: t.id, name: t.name, emoji: t.emoji, streak };
  }
  return best;
}
