import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/** Signed-in Supabase client for the persistent RPC integration-test account. */
export const testClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export async function signInTestUser() {
  const { error } = await testClient.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
  });
  if (error) throw error;
}

type TrackableOverrides = Partial<{
  kind: "habit" | "task";
  name: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  coinValue: number;
  period: "day" | "week" | "month" | null;
  quota: number;
  weekdays: number[] | null;
  /** Backdate for tests that seed historical completions predating "now" — the
   * RPC now refuses to walk/bridge a streak past a trackable's real created_at. */
  createdAt: string;
}>;

/** Inserts a `[TEST]`-prefixed trackable owned by the signed-in test user. */
export async function makeTrackable(overrides: TrackableOverrides = {}) {
  const { data: userData } = await testClient.auth.getUser();
  const row = {
    user_id: userData.user!.id,
    kind: overrides.kind ?? "habit",
    name: `[TEST] ${overrides.name ?? "trackable"}`,
    emoji: overrides.emoji ?? "🧪",
    difficulty: overrides.difficulty ?? "easy",
    coin_value: overrides.coinValue ?? 10,
    period: overrides.kind === "task" ? null : overrides.period ?? "day",
    quota: overrides.quota ?? 1,
    weekdays: overrides.weekdays ?? null,
    ...(overrides.createdAt ? { created_at: overrides.createdAt } : {}),
  };
  const { data, error } = await testClient.from("trackables").insert(row).select().single();
  if (error) throw error;
  return data as { id: string; [key: string]: unknown };
}

export async function cleanupLedgerByRefId(refId: string) {
  await testClient.from("coin_ledger").delete().eq("ref_id", refId);
}

export async function cleanupTrackable(id: string) {
  // coin_ledger rows for completions are keyed by ref_id = completion.id, not trackable id.
  const { data: completions } = await testClient.from("completions").select("id").eq("trackable_id", id);
  for (const { id: completionId } of completions ?? []) {
    await testClient.from("coin_ledger").delete().eq("ref_id", completionId);
  }
  await testClient.from("completions").delete().eq("trackable_id", id);
  await testClient.from("trackables").delete().eq("id", id);
}

export async function makeReward(cost: number) {
  const { data: userData } = await testClient.auth.getUser();
  const { data, error } = await testClient
    .from("rewards")
    .insert({ user_id: userData.user!.id, kind: "personal", name: "[TEST] reward", emoji: "🎁", cost })
    .select()
    .single();
  if (error) throw error;
  return data as { id: string; [key: string]: unknown };
}

export async function cleanupReward(id: string) {
  await testClient.from("coin_ledger").delete().eq("ref_id", id);
  await testClient.from("rewards").delete().eq("id", id);
}

export async function ledgerBalance() {
  const { data: userData } = await testClient.auth.getUser();
  const { data, error } = await testClient
    .from("coin_ledger")
    .select("delta")
    .eq("user_id", userData.user!.id);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.delta, 0);
}

/** ISO "today" in UTC — must match the RPCs' current_app_date(). */
export function todayUTC(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Test arrangement only — the real app never writes freeze_tokens directly. */
export async function setFreezeBalance(balance: number) {
  const { data: userData } = await testClient.auth.getUser();
  const { error } = await testClient
    .from("freeze_tokens")
    .upsert({ user_id: userData.user!.id, balance }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function getFreezeBalance(): Promise<number> {
  const { data: userData } = await testClient.auth.getUser();
  const { data, error } = await testClient
    .from("freeze_tokens")
    .select("balance")
    .eq("user_id", userData.user!.id)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

/** Bumps total XP (and thus level) via a throwaway habit's history — for
 * tests that need to clear a level-gate (e.g. level 3 to create a group). */
export async function seedXp(amount: number): Promise<{ trackableId: string; cleanup: () => Promise<void> }> {
  const t = await makeTrackable({ kind: "habit", name: "xp-funding" });
  await seedHistoricalCompletion(t.id, todayUTC(-100), amount, 0, 0);
  return { trackableId: t.id, cleanup: () => cleanupTrackable(t.id) };
}

/** A second, independent signed-up user — for group-membership / RLS tests
 * that need two real accounts. Returns a signed-in client + their user id. */
export async function makeOtherUser() {
  const email = `habiteer.rpctest.other.${Date.now()}.${Math.random().toString(36).slice(2)}@gmail.com`;
  const password = "OtherUser!2026Habiteer";
  const otherClient = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await otherClient.auth.signUp({ email, password });
  if (error) throw error;
  const { data: userData } = await otherClient.auth.getUser();
  return { client: otherClient, userId: userData.user!.id };
}

export async function makeGroup(name: string) {
  const { data: userData } = await testClient.auth.getUser();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await testClient
    .from("groups")
    .insert({ name: `[TEST] ${name}`, invite_code: inviteCode, created_by: userData.user!.id })
    .select()
    .single();
  if (error) throw error;
  return data as { id: string; invite_code: string; [key: string]: unknown };
}

export async function cleanupGroup(id: string) {
  await testClient.from("group_members").delete().eq("group_id", id);
  await testClient.from("groups").delete().eq("id", id);
}

export async function makeSharedReward(groupId: string, cost: number) {
  const { data, error } = await testClient
    .from("rewards")
    .insert({ kind: "shared", group_id: groupId, name: "[TEST] shared reward", emoji: "🎁", cost })
    .select()
    .single();
  if (error) throw error;
  return data as { id: string; [key: string]: unknown };
}

export async function cleanupSharedReward(id: string) {
  await testClient.from("coin_ledger").delete().eq("ref_id", id);
  await testClient.from("reward_contributions").delete().eq("reward_id", id);
  await testClient.from("rewards").delete().eq("id", id);
}

/** Inserts a completions row directly, bypassing the RPC — for seeding streak history. */
export async function seedHistoricalCompletion(
  trackableId: string,
  isoDate: string,
  xp: number,
  coins: number,
  streakAfter: number
) {
  const { data: userData } = await testClient.auth.getUser();
  const { error } = await testClient.from("completions").insert({
    trackable_id: trackableId,
    user_id: userData.user!.id,
    completed_on: isoDate,
    xp_earned: xp,
    coins_earned: coins,
    streak_after: streakAfter,
  });
  if (error) throw error;
}
