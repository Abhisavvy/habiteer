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

export type SharedReward = {
  id: string;
  groupId: string;
  name: string;
  emoji: string;
  cost: number;
  completedAt: string | null;
  createdAt: string;
  totalContributed: number;
};

/** reward_contributions is embedded via PostgREST's FK-based join and summed client-side —
 * one round trip instead of a separate aggregate query per reward. */
function mapSharedRow(row: Record<string, unknown>): SharedReward {
  const contributions = (row.reward_contributions as Array<{ amount: number }> | null) ?? [];
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    cost: row.cost as number,
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
    totalContributed: contributions.reduce((sum, c) => sum + c.amount, 0),
  };
}

export async function fetchSharedRewards(groupId: string): Promise<SharedReward[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("*, reward_contributions(amount)")
    .eq("group_id", groupId)
    .eq("kind", "shared")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapSharedRow);
}

export async function createSharedReward(groupId: string, values: RewardFormValues): Promise<SharedReward> {
  const parsed = insertRewardSchema.parse(values);
  const { data, error } = await supabase
    .from("rewards")
    .insert({
      kind: "shared",
      group_id: groupId,
      user_id: null,
      name: parsed.name,
      emoji: parsed.emoji,
      cost: parsed.cost,
    })
    .select("*, reward_contributions(amount)")
    .single();
  if (error) throw error;
  return mapSharedRow(data);
}

export async function contributeToReward(
  rewardId: string,
  amount: number
): Promise<{ contributed: number; totalContributed: number; remainingBalance: number; unlocked: boolean }> {
  const { data, error } = await supabase.rpc("fn_contribute_to_reward", { p_reward_id: rewardId, p_amount: amount });
  if (error) throw error;
  return {
    contributed: data.contributed,
    totalContributed: data.totalContributed,
    remainingBalance: data.remainingBalance,
    unlocked: data.unlocked,
  };
}
