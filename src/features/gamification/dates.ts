/** ISO date string, e.g. "2026-07-20". */
export type ISODate = string;

/** Day of week for an ISO date, 0=Sun..6=Sat. */
export function weekday(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

/** The ISO date one day before the given ISO date. */
export function prevDay(date: ISODate): ISODate {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The Monday (UTC) of the ISO week containing the given date. */
export function weekStart(date: ISODate): ISODate {
  const d = new Date(date + "T00:00:00Z");
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Sun=0..Sat=6 -> Sun=6, Mon=0, ...
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** The 1st of the UTC calendar month containing the given date. */
export function monthStart(date: ISODate): ISODate {
  return date.slice(0, 7) + "-01";
}

/** The start of the period immediately before the given period's start date. */
export function prevPeriodStart(periodStart: ISODate, period: "week" | "month"): ISODate {
  const d = new Date(periodStart + "T00:00:00Z");
  if (period === "week") {
    d.setUTCDate(d.getUTCDate() - 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return d.toISOString().slice(0, 10);
}
