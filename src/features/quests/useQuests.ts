import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchQuestClaims, claimQuest } from "./api";

const QUEST_CLAIMS_KEY = ["questClaims"];

export function useQuestClaimsQuery() {
  return useQuery({ queryKey: QUEST_CLAIMS_KEY, queryFn: fetchQuestClaims });
}

export function useClaimQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questId: string) => claimQuest(questId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEST_CLAIMS_KEY });
      queryClient.invalidateQueries({ queryKey: ["coinBalance"] }); // reward credited to the ledger
    },
  });
}
