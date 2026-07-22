import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "@/features/completions/api";
import { filterDueToday } from "@/features/trackables/today";
import { trackableStatus } from "@/features/completions/derived";

export type WidgetSnapshotItem = {
  id: string;
  name: string;
  emoji: string;
  kind: "habit" | "task";
  isDone: boolean;
};

export type WidgetSnapshot = {
  items: WidgetSnapshotItem[];
  coinBalance: number;
  topStreak: number;
  moreCount: number;
};

/** Small serializable summary the widget renders from — capped, no scrolling. */
export function buildWidgetSnapshot(
  trackables: Trackable[],
  completions: Completion[],
  coinBalance: number,
  today: ISODate,
  maxRows: number
): WidgetSnapshot {
  const dueToday = filterDueToday(trackables, today);

  const withStatus = dueToday.map((t) => ({ t, status: trackableStatus(t, completions, today) }));

  const topStreak = withStatus.reduce((max, { status }) => Math.max(max, status.streak), 0);

  // Not-done items first — those are the actionable ones when rows are capped.
  const ordered = [...withStatus].sort((a, b) => Number(a.status.isDoneToday) - Number(b.status.isDoneToday));

  const items: WidgetSnapshotItem[] = ordered.slice(0, maxRows).map(({ t, status }) => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    kind: t.kind,
    isDone: status.isDoneToday,
  }));

  return {
    items,
    coinBalance,
    topStreak,
    moreCount: Math.max(0, dueToday.length - maxRows),
  };
}

/**
 * How many rows persist to storage — generous, since resizing a widget
 * bigger later shouldn't require live app data that a background render
 * doesn't have. Actual visible rows are capped again at render time via
 * `capSnapshotRows`, based on the widget's real current size.
 */
export const PERSIST_MAX_ROWS = 20;

/** Re-caps an already-built snapshot to fewer rows, preserving true moreCount. */
export function capSnapshotRows(snapshot: WidgetSnapshot, maxRows: number): WidgetSnapshot {
  if (snapshot.items.length <= maxRows) return snapshot;
  return {
    ...snapshot,
    items: snapshot.items.slice(0, maxRows),
    moreCount: snapshot.moreCount + (snapshot.items.length - maxRows),
  };
}

/** Simple height-based lookup — no scrolling, so a bigger widget just shows more rows. */
export function rowsForHeight(heightDp: number): number {
  if (heightDp < 110) return 1;
  if (heightDp < 180) return 2;
  if (heightDp < 250) return 3;
  return 4;
}
