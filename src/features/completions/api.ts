import { supabase } from "@/lib/supabase/client";

export type Completion = {
  id: string;
  trackableId: string;
  completedOn: string;
  xpEarned: number;
  coinsEarned: number;
  streakAfter: number;
};

export type CompleteResult = {
  xp: number;
  coins: number;
  streakAfter: number;
  level: { level: number; intoLevel: number; need: number };
  freezeTokens: number;
};

function mapCompletionRow(row: Record<string, unknown>): Completion {
  return {
    id: row.id as string,
    trackableId: row.trackable_id as string,
    completedOn: row.completed_on as string,
    xpEarned: row.xp_earned as number,
    coinsEarned: row.coins_earned as number,
    streakAfter: row.streak_after as number,
  };
}

function mapCompleteResult(data: Record<string, any>): CompleteResult {
  return {
    xp: data.xp,
    coins: data.coins,
    streakAfter: data.streak_after ?? 0,
    level: { level: data.level.level, intoLevel: data.level.into_level, need: data.level.need },
    freezeTokens: data.freeze_tokens,
  };
}

export async function fetchCompletions(): Promise<Completion[]> {
  const { data, error } = await supabase.from("completions").select("*");
  if (error) throw error;
  return data.map(mapCompletionRow);
}

export async function completeTrackable(id: string): Promise<CompleteResult> {
  const { data, error } = await supabase.rpc("fn_complete_trackable", { p_id: id });
  if (error) throw error;
  return mapCompleteResult(data);
}

export async function undoCompletion(id: string): Promise<CompleteResult> {
  const { data, error } = await supabase.rpc("fn_undo_completion", { p_id: id });
  if (error) throw error;
  return mapCompleteResult(data);
}

export async function fetchCoinBalance(): Promise<number> {
  const { data, error } = await supabase.from("coin_ledger").select("delta");
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.delta, 0);
}

export async function fetchFreezeBalance(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("freeze_tokens")
    .select("balance")
    .eq("user_id", userData.user!.id)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}
