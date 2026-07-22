import { supabase } from "@/lib/supabase/client";

export type LeaderboardRow = {
  id: string;
  displayName: string;
  avatar: string;
  weeklyXp: number;
};

function mapRow(row: Record<string, unknown>): LeaderboardRow {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    avatar: row.avatar as string,
    weeklyXp: row.weekly_xp as number,
  };
}

export async function fetchWeeklyLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("weekly_leaderboard")
    .select("id, display_name, avatar, weekly_xp")
    .order("weekly_xp", { ascending: false });
  if (error) throw error;
  return data.map(mapRow);
}
