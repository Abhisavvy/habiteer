import { weekday } from "@/features/gamification/dates";
import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "./api";

/**
 * Trackables due on the given day: tasks are always due (one-off, until
 * archived); week/month-quota habits are always due too (loggable on any
 * day, no weekday gating — PLAN.md §7); day-period habits are due if
 * unscheduled (daily) or today's weekday is in their `weekdays` list.
 * Assumes archived rows are already excluded upstream.
 */
export function filterDueToday(trackables: Trackable[], onDate: ISODate): Trackable[] {
  const todayWeekday = weekday(onDate);
  return trackables.filter((t) => {
    if (t.kind === "task") return true;
    if (t.period !== "day") return true;
    const scheduled = t.weekdays && t.weekdays.length > 0 ? t.weekdays : null;
    return scheduled === null || scheduled.includes(todayWeekday);
  });
}

/** UTC-anchored "today" — must match the server's `current_app_date()`
 * (rpc.sql), which every completion is stamped against. A local-device date
 * would drift from the server's for hours around midnight in any timezone
 * ahead of UTC, silently breaking the done-today check. */
export function today(): ISODate {
  return new Date().toISOString().slice(0, 10);
}
