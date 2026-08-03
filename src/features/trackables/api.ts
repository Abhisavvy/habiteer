import { supabase } from "@/lib/supabase/client";
import { insertTrackableSchema, updateTrackableSchema, type TrackableFormValues, type TrackableUpdateValues } from "./schemas";

export type Trackable = {
  id: string;
  kind: "habit" | "task";
  name: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  coinValue: number;
  goalType: "build" | "reduce";
  period: "day" | "week" | "month" | null;
  quota: number;
  weekdays: number[] | null;
  dueOn: string | null;
  reminderTime: string | null;
  /** Optional one-line "why this matters to me", captured at creation and shown back when momentum is lost. */
  why: string | null;
  archivedAt: string | null;
  createdAt: string;
};

/** PostgREST returns raw snake_case columns; the rest of the app works in camelCase. */
function mapRow(row: Record<string, unknown>): Trackable {
  return {
    id: row.id as string,
    kind: row.kind as Trackable["kind"],
    name: row.name as string,
    emoji: row.emoji as string,
    difficulty: row.difficulty as Trackable["difficulty"],
    coinValue: row.coin_value as number,
    goalType: (row.goal_type as Trackable["goalType"]) ?? "build",
    period: row.period as Trackable["period"],
    quota: row.quota as number,
    weekdays: row.weekdays as number[] | null,
    dueOn: (row.due_on as string | null) ?? null,
    reminderTime: (row.reminder_time as string | null) ?? null,
    why: (row.why as string | null) ?? null,
    archivedAt: row.archived_at as string | null,
    createdAt: row.created_at as string,
  };
}

export async function fetchTrackables(): Promise<Trackable[]> {
  const { data, error } = await supabase
    .from("trackables")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapRow);
}

export async function createTrackable(values: TrackableFormValues): Promise<Trackable> {
  const parsed = insertTrackableSchema.parse(values);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from("trackables")
    .insert({
      user_id: userData.user!.id,
      kind: parsed.kind,
      name: parsed.name,
      emoji: parsed.emoji,
      difficulty: parsed.difficulty,
      coin_value: parsed.coinValue,
      goal_type: parsed.goalType,
      period: parsed.period,
      quota: parsed.quota,
      weekdays: parsed.weekdays,
      due_on: parsed.dueOn,
      reminder_time: parsed.reminderTime,
      why: parsed.why,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateTrackable(id: string, values: TrackableUpdateValues): Promise<Trackable> {
  const parsed = updateTrackableSchema.parse(values);
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.emoji !== undefined) patch.emoji = parsed.emoji;
  if (parsed.difficulty !== undefined) patch.difficulty = parsed.difficulty;
  if (parsed.coinValue !== undefined) patch.coin_value = parsed.coinValue;
  if (parsed.goalType !== undefined) patch.goal_type = parsed.goalType;
  if (parsed.weekdays !== undefined) patch.weekdays = parsed.weekdays;
  if (parsed.period !== undefined) patch.period = parsed.period;
  if (parsed.quota !== undefined) patch.quota = parsed.quota;
  if (parsed.dueOn !== undefined) patch.due_on = parsed.dueOn;
  if (parsed.reminderTime !== undefined) patch.reminder_time = parsed.reminderTime;
  if (parsed.why !== undefined) patch.why = parsed.why;

  const { data, error } = await supabase.from("trackables").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function archiveTrackable(id: string): Promise<void> {
  const { error } = await supabase.from("trackables").update({ archived_at: new Date().toISOString() }).eq("id", id);
  // The trackables RLS WITH CHECK refuses to archive a habit carrying an active
  // pledge, because completing it would then be impossible and the stake would
  // be stranded. Translated here: the raw Postgres row-security message tells
  // the player nothing about what to do next.
  if (error) {
    if (error.code === "42501") {
      throw new Error("This habit has a live pledge on it. Settle or give up the pledge first.");
    }
    throw error;
  }
}
