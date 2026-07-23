import { supabase } from "@/lib/supabase/client";

export type QuestClaim = { questId: string; week: string; reward: number };

/** The caller's quest-claim history (RLS-scoped to own rows). */
export async function fetchQuestClaims(): Promise<QuestClaim[]> {
  const { data, error } = await supabase.from("quest_claims").select("quest_id, week, reward");
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    questId: r.quest_id as string,
    week: r.week as string,
    reward: r.reward as number,
  }));
}

/** Claim a completed quest for its coin reward. Server-validated + idempotent per week. */
export async function claimQuest(questId: string): Promise<{ reward: number; balance: number; week: string }> {
  const { data, error } = await supabase.rpc("fn_claim_quest", { p_quest_id: questId });
  if (error) throw error;
  return { reward: data.reward as number, balance: data.balance as number, week: data.week as string };
}
