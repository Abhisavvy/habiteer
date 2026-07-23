import type { QuestDef } from "@/features/gamification/constants";

/** Client-only presentation for each quest (server never needs this). Falls back
 * to a generic blurb for any quest id without bespoke copy. */
export const QUEST_COPY: Record<string, { emoji: string; title: string; blurb: string }> = {
  busy_bee: { emoji: "🐝", title: "Busy Bee", blurb: "Complete 15 things this week" },
  steady: { emoji: "📆", title: "Steady", blurb: "Show up on 5 days this week" },
  coin_rush: { emoji: "🪙", title: "Coin Rush", blurb: "Earn 200 coins this week" },
  weekend_warrior: { emoji: "⚡", title: "Weekend Warrior", blurb: "8 completions — limited time!" },
};

const METRIC_NOUN: Record<QuestDef["metric"], string> = {
  completions: "completions",
  active_days: "active days",
  coins_earned: "coins",
};

export function questCopy(quest: QuestDef): { emoji: string; title: string; blurb: string } {
  return (
    QUEST_COPY[quest.id] ?? {
      emoji: "🎯",
      title: quest.id,
      blurb: `Reach ${quest.goal} ${METRIC_NOUN[quest.metric]} this week`,
    }
  );
}
