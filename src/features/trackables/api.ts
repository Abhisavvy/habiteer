import { supabase } from "@/lib/supabase/client";
import { insertTrackableSchema, updateTrackableSchema, type TrackableFormValues, type TrackableUpdateValues } from "./schemas";

export type Trackable = {
  id: string;
  kind: "habit" | "task";
  name: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  coinValue: number;
  period: "day" | null;
  quota: number;
  weekdays: number[] | null;
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
    period: row.period as Trackable["period"],
    quota: row.quota as number,
    weekdays: row.weekdays as number[] | null,
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
      period: parsed.kind === "habit" ? "day" : null,
      quota: 1,
      weekdays: parsed.weekdays,
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
  if (parsed.weekdays !== undefined) patch.weekdays = parsed.weekdays;

  const { data, error } = await supabase.from("trackables").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function archiveTrackable(id: string): Promise<void> {
  const { error } = await supabase.from("trackables").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
