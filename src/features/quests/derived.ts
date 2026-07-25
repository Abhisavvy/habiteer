import { QUESTS, type QuestDef, type QuestMetric } from "@/features/gamification/constants";
import { weekStart, type ISODate } from "@/features/gamification/dates";
import type { Completion } from "@/features/completions/api";

export type QuestStatus = {
  quest: QuestDef;
  progress: number; // current metric value this ISO week
  goal: number;
  met: boolean;
  active: boolean; // within its event window (always true for windowless quests)
};

/** Value of a quest metric over the current ISO week (completions on/after weekStartDate). */
export function questMetricValue(metric: QuestMetric, completions: Completion[], weekStartDate: ISODate): number {
  const inWeek = completions.filter((c) => c.completedOn >= weekStartDate);
  switch (metric) {
    case "completions":
      return inWeek.length;
    case "active_days":
      return new Set(inWeek.map((c) => c.completedOn)).size;
    case "coins_earned":
      return inWeek.reduce((sum, c) => sum + c.coinsEarned, 0);
  }
}

/** Whether an event quest's window includes `today` (windowless quests are always active). */
export function isQuestActive(quest: QuestDef, today: ISODate): boolean {
  return (!quest.activeFrom || today >= quest.activeFrom) && (!quest.activeUntil || today <= quest.activeUntil);
}

export function questStatus(quest: QuestDef, completions: Completion[], today: ISODate): QuestStatus {
  const progress = questMetricValue(quest.metric, completions, weekStart(today));
  return {
    quest,
    progress,
    goal: quest.goal,
    met: progress >= quest.goal,
    active: isQuestActive(quest, today),
  };
}

/** Statuses for every quest currently in-window (events outside their window are dropped). */
export function activeQuestStatuses(completions: Completion[], today: ISODate): QuestStatus[] {
  return QUESTS.map((q) => questStatus(q, completions, today)).filter((s) => s.active);
}

export type FeaturedQuest = QuestStatus & { claimed: boolean };

/**
 * The single quest to feature where there's only room for one (the
 * compact widget): an unclaimed quest that's already met — the most
 * exciting state, ready to claim — beats one still in progress; among
 * quests still in progress, the one closest to its own goal (by fraction,
 * not raw count, so a 3/5 and a 40/200 quest compare fairly) wins. A
 * claimed quest is only ever shown as a last resort, if literally nothing
 * else is active. `null` when no quest is active at all (not reachable
 * with today's catalog — busy_bee/steady/coin_rush have no window — but
 * kept correct rather than assumed).
 */
export function featuredQuestStatus(
  completions: Completion[],
  claims: { questId: string; week: ISODate }[],
  today: ISODate
): FeaturedQuest | null {
  const week = weekStart(today);
  const claimedIds = new Set(claims.filter((c) => c.week === week).map((c) => c.questId));
  const statuses: FeaturedQuest[] = activeQuestStatuses(completions, today).map((s) => ({
    ...s,
    claimed: claimedIds.has(s.quest.id),
  }));
  if (statuses.length === 0) return null;

  const unclaimedMet = statuses.filter((s) => s.met && !s.claimed);
  if (unclaimedMet.length > 0) return unclaimedMet[0];

  const unclaimed = statuses.filter((s) => !s.claimed);
  const pool = unclaimed.length > 0 ? unclaimed : statuses;
  return pool.reduce((best, s) => (s.progress / s.goal > best.progress / best.goal ? s : best));
}
