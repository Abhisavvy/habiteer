import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, updateDisplayName, equipCosmetic } from "./api";

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

export function useEquipCosmetic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: "avatarColor" | "title" | "cardSkin"; id: string }) => equipCosmetic(kind, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}
