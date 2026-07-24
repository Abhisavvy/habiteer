import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "@/features/completions/api";
import { taskCoins } from "@/features/gamification/coins";
import { filterDueToday } from "@/features/trackables/today";
import { trackableStatus } from "@/features/completions/derived";

export type WidgetSnapshotItem = {
  id: string;
  name: string;
  emoji: string;
  kind: "habit" | "task";
  payout: number;
  isDone: boolean;
};

/** Matches TrackableCard's payoutCoins — only tasks apply the difficulty discount. */
function payoutFor(t: Trackable): number {
  return t.kind === "task" ? taskCoins(t.difficulty) : t.coinValue;
}

export type WidgetSnapshot = {
  items: WidgetSnapshotItem[];
  coinBalance: number;
  topStreak: number;
  moreCount: number;
  /** Done / total due today — drives the "TODAY · N/M" header (counts all due
   * items, not just the capped visible rows). */
  doneToday: number;
  totalDue: number;
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
    payout: payoutFor(t),
    isDone: status.isDoneToday,
  }));

  return {
    items,
    coinBalance,
    topStreak,
    moreCount: Math.max(0, dueToday.length - maxRows),
    doneToday: withStatus.filter(({ status }) => status.isDoneToday).length,
    totalDue: dueToday.length,
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

// HabitWidget.tsx's chrome that isn't a habit row: the card's own padding
// (12 top + bottom), the header row (28dp icon tile + 8 padding-bottom + 9
// margin-bottom), and the header divider (2). The P2 mock dropped the peeking
// clock card, so that height is gone. Kept as an explicit constant (not a
// guessed bucket) so a header/padding tweak can't silently make the real
// layout taller than this assumes — which clipped rows off the widget twice
// before. Padded above the line-by-line sum (24 padding + 45 header + 2
// divider ≈ 71) since text metrics never land exactly as guessed, and
// under-filling by a few dp of empty space is far cheaper than clipping.
const FIXED_CHROME_DP = 82;
const ROW_HEIGHT_DP = 32;
const MAX_ROWS_SHOWN = 6;

/** No scrolling, so a bigger widget just shows more rows — sized to what
 * HabitWidget.tsx's chrome + per-row height can actually fit without clipping. */
export function rowsForHeight(heightDp: number): number {
  const rows = Math.floor((heightDp - FIXED_CHROME_DP) / ROW_HEIGHT_DP);
  return Math.max(1, Math.min(MAX_ROWS_SHOWN, rows));
}
