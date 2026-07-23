import { supabase } from "@/lib/supabase/client";
import type { LeagueTier } from "@/features/gamification/constants";

export type LeaderboardRow = {
  id: string;
  displayName: string;
  avatar: string;
  weeklyXp: number;
  avatarColor: string;
  titleId: string;
};

function mapRow(row: Record<string, unknown>): LeaderboardRow {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    avatar: row.avatar as string,
    weeklyXp: row.weekly_xp as number,
    avatarColor: (row.avatar_color as string) ?? "violet",
    titleId: (row.title_id as string) ?? "novice",
  };
}

export async function fetchWeeklyLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("weekly_leaderboard")
    .select("id, display_name, avatar, weekly_xp, avatar_color, title_id")
    .order("weekly_xp", { ascending: false });
  if (error) throw error;
  return data.map(mapRow);
}

export type LeagueSyncResult = {
  tier: LeagueTier;
  week: string;
  promoted: boolean;
  relegated: boolean;
  previousTier?: LeagueTier;
};

/** Idempotent per ISO week — safe to call on every Board screen mount.
 * Settles the previous week (promote/relegate/stay) and seeds the current
 * week's row the first time it's called after a week boundary. */
export async function syncLeague(): Promise<LeagueSyncResult> {
  const { data, error } = await supabase.rpc("fn_sync_league");
  if (error) throw error;
  return {
    tier: data.tier,
    week: data.week,
    promoted: data.promoted,
    relegated: data.relegated,
    previousTier: data.previousTier,
  };
}

export async function fetchMyLeague(): Promise<LeagueTier | null> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("league_standings")
    .select("tier")
    .eq("user_id", userData.user!.id)
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.tier as LeagueTier) ?? null;
}
