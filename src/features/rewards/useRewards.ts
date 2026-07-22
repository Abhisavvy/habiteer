import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRewards, createReward, updateReward, deleteReward, redeemReward } from "./api";
import type { RewardFormValues, RewardUpdateValues } from "./schemas";

const REWARDS_KEY = ["rewards"];
const COIN_BALANCE_KEY = ["coinBalance"];

export function useRewardsQuery() {
  return useQuery({ queryKey: REWARDS_KEY, queryFn: fetchRewards });
}

export function useCreateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RewardFormValues) => createReward(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REWARDS_KEY }),
  });
}

export function useUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: RewardUpdateValues }) => updateReward(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REWARDS_KEY }),
  });
}

export function useDeleteReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReward(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REWARDS_KEY }),
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => redeemReward(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REWARDS_KEY });
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_KEY });
    },
  });
}
