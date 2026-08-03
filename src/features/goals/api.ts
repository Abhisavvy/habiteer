import { supabase } from "@/lib/supabase/client";
import type { ISODate } from "@/features/gamification/dates";

export type Goal = {
  id: string;
  trackableId: string;
  targetCount: number;
  startsOn: ISODate;
  endsOn: ISODate; // inclusive
};

export type GoalFormValues = {
  trackableId: string;
  targetCount: number;
  startsOn: ISODate;
  endsOn: ISODate;
};

function mapRow(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    trackableId: row.trackable_id as string,
    targetCount: row.target_count as number,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
  };
}

/** The caller's own goals (RLS-scoped) — no filtering by state here, that's derived client-side via `goalStatus`. */
export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from("goals").select("*");
  if (error) throw error;
  return data.map(mapRow);
}

/** Rejected by the DB's exclusion constraint if this trackable already has a goal whose window overlaps. */
export async function createGoal(values: GoalFormValues): Promise<Goal> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userData.user!.id,
      trackable_id: values.trackableId,
      target_count: values.targetCount,
      starts_on: values.startsOn,
      ends_on: values.endsOn,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Ends a goal early (or clears an ended one) — no edit path by design, delete + recreate instead. */
export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
