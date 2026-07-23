import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWeeklyLeaderboard, fetchMyLeague, syncLeague } from "./api";

const LEAGUE_KEY = ["myLeague"];

export function useLeaderboardQuery() {
  return useQuery({ queryKey: ["leaderboard"], queryFn: fetchWeeklyLeaderboard });
}

export function useMyLeagueQuery() {
  return useQuery({ queryKey: LEAGUE_KEY, queryFn: fetchMyLeague });
}

/** Fires fn_sync_league() once per screen mount — idempotent per ISO week
 * (a safe no-op if already synced for the current week), so calling it on
 * every Board visit is how the weekly rollover happens without a cron. */
export function useSyncLeagueOnMount() {
  const queryClient = useQueryClient();
  useEffect(() => {
    syncLeague()
      .then(() => queryClient.invalidateQueries({ queryKey: LEAGUE_KEY }))
      .catch((err) => console.warn("[league] sync failed:", err));
  }, [queryClient]);
}
