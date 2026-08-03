import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGoals, createGoal, deleteGoal } from "./api";
import type { GoalFormValues } from "./api";

const GOALS_KEY = ["goals"];

export function useGoalsQuery() {
  return useQuery({ queryKey: GOALS_KEY, queryFn: fetchGoals });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: GoalFormValues) => createGoal(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}
