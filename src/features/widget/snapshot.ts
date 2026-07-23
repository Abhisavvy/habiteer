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

// HabitWidget.tsx's chrome that isn't a habit row: outer padding, the peeking
// clock card (CLOCK_PEEK_DP — the main card's marginTop, since the clock card
// itself sits behind and only its uncovered sliver adds real height), the main
// card's own padding, the header row (icon + title + coins), the divider, and
// the footer row — everything that costs height regardless of item count.
// Kept as an explicit constant (not a guessed bucket) so a header/padding/
// clock tweak can't silently make the real layout taller than this function
// assumes — which is exactly what clipped rows off the widget twice already
// (once with no clock, once after the clock came back with too tight a
// margin). Padded well above the line-by-line sum (40 clock peek + 12 outer
// padding + 16 card padding + 22 header row + 2 divider + 22 footer ≈ 114) —
// text line-height and font metrics never come out exactly as guessed, and
// under-filling by a few dp of empty space is far cheaper than clipping.
const FIXED_CHROME_DP = 135;
const ROW_HEIGHT_DP = 34;
const MAX_ROWS_SHOWN = 6;

/** No scrolling, so a bigger widget just shows more rows — sized to what
 * HabitWidget.tsx's chrome + per-row height can actually fit without clipping. */
export function rowsForHeight(heightDp: number): number {
  const rows = Math.floor((heightDp - FIXED_CHROME_DP) / ROW_HEIGHT_DP);
  return Math.max(1, Math.min(MAX_ROWS_SHOWN, rows));
}
