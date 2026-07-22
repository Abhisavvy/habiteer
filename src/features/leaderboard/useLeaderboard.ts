import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyLeaderboard } from "./api";

export function useLeaderboardQuery() {
  return useQuery({ queryKey: ["leaderboard"], queryFn: fetchWeeklyLeaderboard });
}
