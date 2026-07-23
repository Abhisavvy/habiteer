import type { Trackable } from "@/features/trackables/api";

/**
 * Pure reminder-scheduling logic — expo-agnostic on purpose so it can be
 * unit-tested without the native `expo-notifications` module. The effect
 * layer (`scheduler.ts`) maps these descriptors onto expo trigger inputs.
 */

export type ReminderTrigger =
  | { type: "daily"; hour: number; minute: number }
  /** `weekday` uses expo's 1=Sunday … 7=Saturday convention (our stored weekdays are 0=Sun … 6=Sat). */
  | { type: "weekly"; weekday: number; hour: number; minute: number }
  /** One-off, at a local wall-clock instant "YYYY-MM-DDTHH:MM:SS" (no timezone → device-local). */
  | { type: "date"; date: string };

export type ReminderRequest = {
  /** Deterministic per trackable+slot, e.g. "abc:0" — handy for debugging even though we full-resync. */
  identifier: string;
  title: string;
  body: string;
  trigger: ReminderTrigger;
};

/** Parse a stored "HH:MM" (zero-padded, 24h). Returns null for anything malformed/out-of-range. */
export function parseTime(hhmm: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

const pad = (n: number) => String(n).padStart(2, "0");

function copyFor(t: Trackable): { title: string; body: string } {
  if (t.kind === "task") {
    return { title: `📌 ${t.name}`, body: "Don't forget this today." };
  }
  if (t.goalType === "reduce") {
    return { title: `🛡️ ${t.name}`, body: "Stay strong — resist today and protect your streak." };
  }
  return { title: `⏰ ${t.name}`, body: "Time for your habit — keep the streak going!" };
}

/**
 * Build the local-notification requests for one trackable, given the current
 * instant (injected for testability):
 * - `reminderTime` null/malformed → no reminders.
 * - Daily habit → one repeating daily trigger.
 * - Specific-weekday habit → one repeating weekly trigger per scheduled day.
 * - Week/month-quota habit → a daily nudge at the chosen time.
 * - Task → a single one-off trigger on its `dueOn` day; none if it has no
 *   `dueOn` (an "anytime" task has no time anchor) or if that instant is past.
 */
export function notificationRequestsFor(t: Trackable, now: Date = new Date()): ReminderRequest[] {
  if (!t.reminderTime) return [];
  const parsed = parseTime(t.reminderTime);
  if (!parsed) return [];
  const { hour, minute } = parsed;
  const { title, body } = copyFor(t);
  const req = (i: number, trigger: ReminderTrigger): ReminderRequest => ({
    identifier: `${t.id}:${i}`,
    title,
    body,
    trigger,
  });

  if (t.kind === "task") {
    if (!t.dueOn) return [];
    const date = `${t.dueOn}T${pad(hour)}:${pad(minute)}:00`;
    if (new Date(date).getTime() <= now.getTime()) return []; // slot already passed
    return [req(0, { type: "date", date })];
  }

  // Habit. Specific-weekday habits fire weekly per day; everything else
  // (plain daily, and week/month quotas) gets a daily nudge.
  if (t.period === "day" && t.weekdays && t.weekdays.length > 0) {
    return t.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d, i) => req(i, { type: "weekly", weekday: d + 1, hour, minute }));
  }
  return [req(0, { type: "daily", hour, minute })];
}
