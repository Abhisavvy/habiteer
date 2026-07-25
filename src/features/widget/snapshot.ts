import type { ISODate } from "@/features/gamification/dates";
import type { Trackable } from "@/features/trackables/api";
import type { Completion } from "@/features/completions/api";
import { taskCoins } from "@/features/gamification/coins";
import { filterDueToday } from "@/features/trackables/today";
import { trackableStatus, overallProgress } from "@/features/completions/derived";
import { DAILY_STRIP_BANNER_HEIGHT, TODAY_BANNER_HEIGHT } from "./palette";

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
  /** Overall level progress — the Companion and expanded-Today widgets show
   * "LVL N" and a progress bar; the compact Today widget ignores these. */
  level: number;
  intoLevel: number;
  need: number;
  /** Only the Daily strip widget's banner shows this ("LVL N · NAME") —
   * defaults to "" so every existing call site (tests, the compact/
   * Companion/Streak widgets) doesn't need to pass it. */
  displayName: string;
};

/** Small serializable summary the widget renders from — capped, no scrolling. */
export function buildWidgetSnapshot(
  trackables: Trackable[],
  completions: Completion[],
  coinBalance: number,
  today: ISODate,
  maxRows: number,
  displayName: string = ""
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

  const { level, intoLevel, need } = overallProgress(completions);

  return {
    items,
    coinBalance,
    topStreak,
    moreCount: Math.max(0, dueToday.length - maxRows),
    doneToday: withStatus.filter(({ status }) => status.isDoneToday).length,
    totalDue: dueToday.length,
    level,
    intoLevel,
    need,
    displayName,
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

// HabitWidget.tsx's chrome that isn't a habit row: the full-bleed ink
// banner header (TODAY_BANNER_HEIGHT, outside contentPadding entirely since
// P2's redesign) + the body's own vertical padding (12 top + 12 bottom).
// Kept as an explicit constant built from the same shared banner-height
// constant the component itself renders with (not a guessed bucket) so a
// header/padding tweak can't silently make the real layout taller than
// this assumes — which clipped rows off the widget twice before this
// session. Padded a few dp above the exact sum (44 + 24 = 68) for the
// header's Bangers TextWidget's own line-box overshoot at this size.
const FIXED_CHROME_DP = TODAY_BANNER_HEIGHT + 24 + 4;
const ROW_HEIGHT_DP = 32;
const MAX_ROWS_SHOWN = 6;

/** No scrolling, so a bigger widget just shows more rows — sized to what
 * HabitWidget.tsx's chrome + per-row height can actually fit without clipping. */
export function rowsForHeight(heightDp: number): number {
  const rows = Math.floor((heightDp - FIXED_CHROME_DP) / ROW_HEIGHT_DP);
  return Math.max(1, Math.min(MAX_ROWS_SHOWN, rows));
}

// TodayWidgetExpanded.tsx (Daily strip 4×4)'s chrome: the violet banner
// (DAILY_STRIP_BANNER_HEIGHT — an *exact* height, not an estimate, since the
// component itself sets it explicitly on every layer) + the body's own
// vertical padding (13 top + 13 bottom). Row height is the same as the
// compact widget's — the trailing "+N" payout text sits inline, it doesn't
// add a line. A small margin above the exact sum (64 + 26 = 90) for the
// same reason as the compact constant above.
const FIXED_CHROME_DP_EXPANDED = DAILY_STRIP_BANNER_HEIGHT + 26 + 4;

export function rowsForHeightExpanded(heightDp: number): number {
  const rows = Math.floor((heightDp - FIXED_CHROME_DP_EXPANDED) / ROW_HEIGHT_DP);
  return Math.max(1, Math.min(MAX_ROWS_SHOWN, rows));
}
