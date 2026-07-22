import { supabase } from "@/lib/supabase/client";

export type Profile = { id: string; displayName: string };

export async function fetchProfile(): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userData.user!.id)
    .single();
  if (error) throw error;
  return { id: data.id as string, displayName: data.display_name as string };
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userData.user!.id);
  if (error) throw error;
}
