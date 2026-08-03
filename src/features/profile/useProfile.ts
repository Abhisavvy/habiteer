import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, fetchTitleGrants, updateDisplayName, equipCosmetic } from "./api";

const PROFILE_KEY = ["profile"];
/** Nested under PROFILE_KEY on purpose: TanStack invalidates by key PREFIX, so
 * anything that already invalidates ["profile"] — including the pledge
 * mutations that grant a title — refreshes the grants too, with no second
 * invalidation to remember. */
const TITLE_GRANTS_KEY = ["profile", "titleGrants"];

export function useProfileQuery() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: fetchProfile });
}

export function useTitleGrantsQuery() {
  return useQuery({ queryKey: TITLE_GRANTS_KEY, queryFn: fetchTitleGrants });
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
