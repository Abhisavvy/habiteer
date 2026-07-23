import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyGroups, fetchGroupDetail, fetchGroupActivity, createGroup, joinGroup } from "./api";
import type { GroupFormValues } from "./schemas";

const GROUPS_KEY = ["groups"];
const groupDetailKey = (id: string) => ["groups", id];
const groupActivityKey = (id: string) => ["groups", id, "activity"];

export function useMyGroupsQuery() {
  return useQuery({ queryKey: GROUPS_KEY, queryFn: fetchMyGroups });
}

export function useGroupDetailQuery(id: string) {
  return useQuery({ queryKey: groupDetailKey(id), queryFn: () => fetchGroupDetail(id) });
}

export function useGroupActivityQuery(id: string) {
  return useQuery({ queryKey: groupActivityKey(id), queryFn: () => fetchGroupActivity(id) });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: GroupFormValues) => createGroup(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinGroup(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}
