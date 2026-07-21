import { weekday } from "@/features/gamification/dates";
import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "./api";

/**
 * Trackables due on the given day: tasks are always due (one-off, until
 * archived); habits are due if unscheduled (daily) or today's weekday is in
 * their `weekdays` list. Assumes archived rows are already excluded upstream.
 */
export function filterDueToday(trackables: Trackable[], onDate: ISODate): Trackable[] {
  const todayWeekday = weekday(onDate);
  return trackables.filter((t) => {
    if (t.kind === "task") return true;
    const scheduled = t.weekdays && t.weekdays.length > 0 ? t.weekdays : null;
    return scheduled === null || scheduled.includes(todayWeekday);
  });
}

/** Local-device "today," matching the old prototype's isoLocal() convention — display only. */
export function today(): ISODate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
