import { supabase } from "@/lib/supabase/client";
import { insertRewardSchema, updateRewardSchema, type RewardFormValues, type RewardUpdateValues } from "./schemas";

export type Reward = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  completedAt: string | null;
  createdAt: string;
};

/** PostgREST returns raw snake_case columns; the rest of the app works in camelCase. */
function mapRow(row: Record<string, unknown>): Reward {
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    cost: row.cost as number,
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
  };
}

export async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .is("completed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapRow);
}

export async function createReward(values: RewardFormValues): Promise<Reward> {
  const parsed = insertRewardSchema.parse(values);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from("rewards")
    .insert({
      user_id: userData.user!.id,
      kind: "personal",
      name: parsed.name,
      emoji: parsed.emoji,
      cost: parsed.cost,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateReward(id: string, values: RewardUpdateValues): Promise<Reward> {
  const parsed = updateRewardSchema.parse(values);
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.emoji !== undefined) patch.emoji = parsed.emoji;
  if (parsed.cost !== undefined) patch.cost = parsed.cost;

  const { data, error } = await supabase.from("rewards").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data);
}

/** No soft-delete column on rewards (unlike trackables) — an un-redeemed reward is hard-deleted. */
export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) throw error;
}

export async function redeemReward(id: string): Promise<{ balance: number }> {
  const { data, error } = await supabase.rpc("fn_redeem_reward", { p_id: id });
  if (error) throw error;
  return { balance: data.balance };
}
