import { prevDay, type ISODate } from "@/features/gamification/dates";

const MAX_LOOKBACK = 4000; // ~11 years; safety bound, mirrors gamification/streak.ts

/** One member's activity on one day (derived server-side from completions). */
export type ActivityRow = { userId: string; day: ISODate };

function activeSetsByMember(activity: ActivityRow[], memberIds: string[]): Map<string, Set<ISODate>> {
  const members = new Set(memberIds);
  const map = new Map<string, Set<ISODate>>();
  memberIds.forEach((id) => map.set(id, new Set()));
  for (const { userId, day } of activity) {
    if (members.has(userId)) map.get(userId)!.add(day); // ignore rows from non-members
  }
  return map;
}

/**
 * Shared group streak = consecutive days on which EVERY current member showed
 * up (logged ≥1 completion). Mirrors the personal day-streak grace rule
 * (gamification/streak.ts): a past day not-all-done breaks the streak, but the
 * current day is never a miss — if not everyone is done today yet, the streak
 * simply holds through yesterday and extends once the last member checks in.
 *
 * @param activity Flat (userId, day) rows for the group's members.
 * @param memberIds The group's CURRENT members — a day counts only if all of them were active.
 * @param today Today's ISO date.
 */
export function groupStreak(activity: ActivityRow[], memberIds: string[], today: ISODate): number {
  if (memberIds.length === 0) return 0;
  const sets = activeSetsByMember(activity, memberIds);
  const allDone = (day: ISODate) => memberIds.every((id) => sets.get(id)!.has(day));

  let streak = 0;
  let cursor = today;
  for (let i = 0; i < MAX_LOOKBACK; i++) {
    if (allDone(cursor)) {
      streak += 1;
    } else if (cursor !== today) {
      break; // a past day someone missed
    }
    // today not-all-done: grace, keep looking back without counting it
    cursor = prevDay(cursor);
  }
  return streak;
}

/** Per-member "has shown up today?" — drives the social nudge on the group screen. */
export function membersDoneToday(
  activity: ActivityRow[],
  memberIds: string[],
  today: ISODate
): { userId: string; done: boolean }[] {
  const sets = activeSetsByMember(activity, memberIds);
  return memberIds.map((userId) => ({ userId, done: sets.get(userId)!.has(today) }));
}
