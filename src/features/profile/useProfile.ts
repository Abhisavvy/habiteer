import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, updateDisplayName } from "./api";

const PROFILE_KEY = ["profile"];

export function useProfileQuery() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: fetchProfile });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => updateDisplayName(displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
