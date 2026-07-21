import { prevDay, weekday, type ISODate } from "./dates";

const MAX_LOOKBACK = 4000; // ~11 years; safety bound

/**
 * Current streak = consecutive satisfied scheduled periods ending today.
 * v1 covers period = day, optionally limited to specific weekdays.
 *
 * Rules: unscheduled days are skipped (never a miss); a scheduled day that is
 * not completed breaks the streak UNLESS it is today (grace — the day isn't over).
 *
 * @param completed ISO dates the habit was completed on.
 * @param opts.weekdays Allowed weekdays (0=Sun..6=Sat); empty/undefined = every day.
 * @param today Today's ISO date.
 */
export function currentStreak(
  completed: ISODate[],
  opts: { weekdays?: number[] },
  today: ISODate
): number {
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
