import { supabase } from "@/lib/supabase/client";

export type Profile = { id: string; displayName: string; avatarColor: string; titleId: string; cardSkin: string };

export async function fetchProfile(): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, title_id, card_skin")
    .eq("id", userData.user!.id)
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarColor: (data.avatar_color as string) ?? "violet",
    titleId: (data.title_id as string) ?? "novice",
    cardSkin: (data.card_skin as string) ?? "plain",
  };
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userData.user!.id);
  if (error) throw error;
}

/** Equip a cosmetic via a direct profiles update — the level gate is enforced
 * by the profiles RLS WITH CHECK, so this surfaces a friendly error rather
 * than "succeeding" on an unlock the caller hasn't earned. */
export async function equipCosmetic(kind: "avatarColor" | "title" | "cardSkin", id: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const patch =
    kind === "avatarColor" ? { avatar_color: id } : kind === "title" ? { title_id: id } : { card_skin: id };
  const { error } = await supabase.from("profiles").update(patch).eq("id", userData.user!.id);
  if (error) throw new Error("You haven't unlocked that yet.");
}
