import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCompletions, fetchCoinBalance, fetchFreezeBalance, completeTrackable, undoCompletion } from "./api";

const COMPLETIONS_KEY = ["completions"];
const COIN_BALANCE_KEY = ["coinBalance"];
const FREEZE_BALANCE_KEY = ["freezeBalance"];
const TRACKABLES_KEY = ["trackables"];

export function useCompletionsQuery() {
  return useQuery({ queryKey: COMPLETIONS_KEY, queryFn: fetchCompletions });
}

export function useCoinBalanceQuery() {
  return useQuery({ queryKey: COIN_BALANCE_KEY, queryFn: fetchCoinBalance });
}

export function useFreezeBalanceQuery() {
  return useQuery({ queryKey: FREEZE_BALANCE_KEY, queryFn: fetchFreezeBalance });
}

function useInvalidateAfterCompletion() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: COMPLETIONS_KEY });
    queryClient.invalidateQueries({ queryKey: COIN_BALANCE_KEY });
    queryClient.invalidateQueries({ queryKey: FREEZE_BALANCE_KEY });
    queryClient.invalidateQueries({ queryKey: TRACKABLES_KEY }); // tasks archive/un-archive
  };
}

export function useCompleteTrackable() {
  const invalidate = useInvalidateAfterCompletion();
  return useMutation({
    mutationFn: (id: string) => completeTrackable(id),
    onSuccess: invalidate,
  });
}

export function useUndoCompletion() {
  const invalidate = useInvalidateAfterCompletion();
  return useMutation({
    mutationFn: (id: string) => undoCompletion(id),
    onSuccess: invalidate,
  });
}
