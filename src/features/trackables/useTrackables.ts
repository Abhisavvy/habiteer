import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTrackables, createTrackable, updateTrackable, archiveTrackable } from "./api";
import type { TrackableFormValues, TrackableUpdateValues } from "./schemas";

const TRACKABLES_KEY = ["trackables"];

export function useTrackablesQuery() {
  return useQuery({ queryKey: TRACKABLES_KEY, queryFn: fetchTrackables });
}

export function useCreateTrackable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TrackableFormValues) => createTrackable(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRACKABLES_KEY }),
  });
}

export function useUpdateTrackable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TrackableUpdateValues }) => updateTrackable(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRACKABLES_KEY }),
  });
}

export function useArchiveTrackable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTrackable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRACKABLES_KEY }),
  });
}
