import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGoals, createPledge, bankCheckpoint, settleGoal, abandonPledge } from "./api";
import type { GoalFormValues } from "./api";

const GOALS_KEY = ["goals"];
/** Same key `useCompletions`/`useRewards` use. Every pledge mutation moves
 * coins, so skipping this invalidation leaves the header HUD showing a balance
 * the server no longer agrees with. */
const COIN_BALANCE_KEY = ["coinBalance"];
/** The earned `marathoner` title lands in `title_grants`, which the cosmetics
 * picker reads through the profile query — a completed pledge has to refresh it
 * or the new title stays invisible until the next cold start. */
const PROFILE_KEY = ["profile"];

export function useGoalsQuery() {
  return useQuery({ queryKey: GOALS_KEY, queryFn: fetchGoals });
}

/** Shared by every pledge mutation: pledges, checkpoints and settlements all
 * change both the pledge row and the balance. */
function usePledgeMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_KEY });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}

export function useCreatePledge() {
  return usePledgeMutation((values: GoalFormValues) => createPledge(values));
}

export function useBankCheckpoint() {
  return usePledgeMutation((id: string) => bankCheckpoint(id));
}

export function useSettleGoal() {
  return usePledgeMutation((id: string) => settleGoal(id));
}

export function useAbandonPledge() {
  return usePledgeMutation((id: string) => abandonPledge(id));
}
