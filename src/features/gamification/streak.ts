import { prevDay, nextDay, weekday, weekStart, monthStart, prevPeriodStart, nextPeriodStart, type ISODate } from "./dates";

const MAX_LOOKBACK = 4000; // ~11 years; safety bound
const MAX_LOOKBACK_PERIODS = 600; // ~11+ years of weeks; same intent as MAX_LOOKBACK, period-scaled

type Period = "day" | "week" | "month";

/**
 * Current streak = consecutive satisfied periods ending today. v1 covers
 * period = day, optionally limited to specific weekdays; v2 adds
 * period = week/month with a quota (PLAN.md §7 — "3x/week", "monthly").
 *
 * Day rules (unchanged from v1): unscheduled days are skipped (never a
 * miss); a scheduled day that is not completed breaks the streak UNLESS it
 * is today (grace — the day isn't over).
 *
 * Week/month rules: a period counts once its completions-so-far reach
 * quota — including the current, still-open period. The current period is
 * never "missed," only not-yet-satisfied; a fully elapsed prior period
 * under quota breaks the streak. See `periodProgress` for the current
 * period's own completed/quota count.
 *
 * @param completed ISO dates the habit was completed on.
 * @param opts.weekdays Allowed weekdays (0=Sun..6=Sat), day-period only; empty/undefined = every day.
 * @param opts.period Defaults to "day".
 * @param opts.quota Defaults to 1. Ignored for period "day" (always 1 there).
 * @param today Today's ISO date.
 */
export function currentStreak(
  completed: ISODate[],
  opts: { weekdays?: number[]; period?: Period; quota?: number },
  today: ISODate
): number {
  const period = opts.period ?? "day";
  if (period !== "day") {
    return currentStreakForPeriod(completed, period, opts.quota ?? 1, today);
  }

  const done = new Set(completed);
  const scheduledDays = opts.weekdays && opts.weekdays.length > 0 ? opts.weekdays : null;
  let streak = 0;
  let cursor = today;

  for (let i = 0; i < MAX_LOOKBACK; i++) {
    const isScheduled = scheduledDays === null || scheduledDays.includes(weekday(cursor));
    if (isScheduled) {
      if (done.has(cursor)) {
        streak += 1;
      } else if (cursor !== today) {
        break; // a past scheduled day was missed
      }
      // if it's today and not done: grace, keep looking back
    }
    cursor = prevDay(cursor);
  }
  return streak;
}

function periodStartOf(period: "week" | "month", date: ISODate): ISODate {
  return period === "week" ? weekStart(date) : monthStart(date);
}

function currentStreakForPeriod(
  completed: ISODate[],
  period: "week" | "month",
  quota: number,
  today: ISODate
): number {
  const countInPeriod = (periodStart: ISODate) =>
    completed.filter((d) => periodStartOf(period, d) === periodStart).length;

  let cursor = periodStartOf(period, today);
  let streak = 0;

  if (countInPeriod(cursor) >= quota) {
    streak += 1;
  }
  cursor = prevPeriodStart(cursor, period);

  for (let i = 0; i < MAX_LOOKBACK_PERIODS; i++) {
    if (countInPeriod(cursor) < quota) break; // a fully elapsed period under quota breaks the streak
    streak += 1;
    cursor = prevPeriodStart(cursor, period);
  }
  return streak;
}

/**
 * Longest streak ever achieved (all-time max), by the same rules as
 * `currentStreak` — but scanning forward from the earliest completion
 * instead of backward from today, so a past run isn't shadowed by a
 * shorter one still in progress. Profile's "Longest streak" stat.
 */
export function longestStreakEver(
  completed: ISODate[],
  opts: { weekdays?: number[]; period?: Period; quota?: number },
  today: ISODate
): number {
  if (completed.length === 0) return 0;
  const period = opts.period ?? "day";
  if (period !== "day") {
    return longestStreakEverForPeriod(completed, period, opts.quota ?? 1, today);
  }

  const done = new Set(completed);
  const scheduledDays = opts.weekdays && opts.weekdays.length > 0 ? opts.weekdays : null;
  let cursor = completed.reduce((min, d) => (d < min ? d : min), completed[0]);
  let best = 0;
  let running = 0;

  for (let i = 0; i <= MAX_LOOKBACK && cursor <= today; i++) {
    const isScheduled = scheduledDays === null || scheduledDays.includes(weekday(cursor));
    if (isScheduled) {
      if (done.has(cursor)) {
        running += 1;
        if (running > best) best = running;
      } else if (cursor !== today) {
        running = 0; // a past scheduled day was missed
      }
      // if it's today and not done: grace, running carries over unresolved
    }
    cursor = nextDay(cursor);
  }
  return best;
}

function longestStreakEverForPeriod(
  completed: ISODate[],
  period: "week" | "month",
  quota: number,
  today: ISODate
): number {
  const countInPeriod = (periodStart: ISODate) =>
    completed.filter((d) => periodStartOf(period, d) === periodStart).length;

  const earliest = completed.reduce((min, d) => (d < min ? d : min), completed[0]);
  const todayStart = periodStartOf(period, today);
  let cursor = periodStartOf(period, earliest);
  let best = 0;
  let running = 0;

  for (let i = 0; i <= MAX_LOOKBACK_PERIODS && cursor <= todayStart; i++) {
    if (countInPeriod(cursor) >= quota) {
      running += 1;
      if (running > best) best = running;
    } else if (cursor !== todayStart) {
      running = 0; // a fully elapsed period under quota breaks the streak
    }
    // if cursor is the current period and under quota: grace, not yet elapsed
    cursor = nextPeriodStart(cursor, period);
  }
  return best;
}

/** Completions so far in the current period (for display, e.g. "2/3 this week"). Week/month only. */
export function periodProgress(
  completed: ISODate[],
  period: "week" | "month",
  quota: number,
  today: ISODate
): { completed: number; quota: number } {
  const currentStart = periodStartOf(period, today);
  const count = completed.filter((d) => periodStartOf(period, d) === currentStart).length;
  return { completed: count, quota };
}
