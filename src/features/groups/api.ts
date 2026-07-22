import { supabase } from "@/lib/supabase/client";
import { insertGroupSchema, type GroupFormValues } from "./schemas";

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
};

export type GroupMember = {
  userId: string;
  displayName: string;
  avatar: string;
};

export type GroupDetail = Group & { members: GroupMember[] };

/** PostgREST returns raw snake_case columns; the rest of the app works in camelCase. */
function mapRow(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    inviteCode: row.invite_code as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

// Excludes 0/O and 1/I — easy to misread when a code is shared out loud or typed by hand.
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export async function fetchMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from("groups").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapRow);
}

export async function fetchGroupDetail(id: string): Promise<GroupDetail> {
  const { data: groupRow, error: groupError } = await supabase.from("groups").select("*").eq("id", id).single();
  if (groupError) throw groupError;

  const { data: memberRows, error: memberError } = await supabase
    .from("group_members")
    .select("user_id, profiles(display_name, avatar)")
    .eq("group_id", id);
  if (memberError) throw memberError;

  const members: GroupMember[] = (memberRows ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as Record<string, unknown> | null;
    return {
      userId: row.user_id as string,
      displayName: (profile?.display_name as string | undefined) ?? "?",
      avatar: (profile?.avatar as string | undefined) ?? "",
    };
  });

  return { ...mapRow(groupRow), members };
}

/** Retries on an invite_code collision (23505) — negligible odds at 33^6, no dedicated SQL generator needed. */
export async function createGroup(values: GroupFormValues): Promise<Group> {
  const parsed = insertGroupSchema.parse(values);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: parsed.name, invite_code: randomInviteCode(), created_by: userData.user!.id })
      .select()
      .single();
    if (!error) return mapRow(data);
    if (error.code !== "23505") throw error;
  }
  throw new Error("Couldn't generate a unique invite code — try again.");
}

export async function joinGroup(code: string): Promise<{ id: string; name: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc("fn_join_group", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return { id: data.id, name: data.name, inviteCode: data.inviteCode };
}
