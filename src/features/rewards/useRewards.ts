import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRewards,
  createReward,
  updateReward,
  deleteReward,
  redeemReward,
  fetchSharedRewards,
  createSharedReward,
  contributeToReward,
} from "./api";
import type { RewardFormValues, RewardUpdateValues } from "./schemas";

const REWARDS_KEY = ["rewards"];
const COIN_BALANCE_KEY = ["coinBalance"];
const sharedRewardsKey = (groupId: string) => ["sharedRewards", groupId];

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

export function useSharedRewardsQuery(groupId: string) {
  return useQuery({ queryKey: sharedRewardsKey(groupId), queryFn: () => fetchSharedRewards(groupId) });
}

export function useCreateSharedReward(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RewardFormValues) => createSharedReward(groupId, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharedRewardsKey(groupId) }),
  });
}

export function useContributeToReward(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, amount }: { rewardId: string; amount: number }) => contributeToReward(rewardId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedRewardsKey(groupId) });
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_KEY });
    },
  });
}
