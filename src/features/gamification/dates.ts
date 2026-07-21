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
