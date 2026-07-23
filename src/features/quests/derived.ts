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
