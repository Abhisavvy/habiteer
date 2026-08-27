import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

/** Signed-in Supabase client for the persistent RPC integration-test account.
 * Goes through PostgREST + RLS, exactly like the real app — so anything these
 * tests ASSERT is asserted against the same privilege boundary users get. */
export const testClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Admin escape hatch for SEEDING ONLY, over a direct Postgres connection
 * (DATABASE_URL, already used by scripts/apply-sql.ts) which bypasses RLS.
 *
 * Phase S closed `completions`, `coin_ledger`, `freeze_tokens`,
 * `quest_claims` and `league_standings` to client writes — that's the whole
 * point of it — which broke every seed helper below that used to insert
 * through `testClient`. Seeding now goes through here instead.
 *
 * The split is deliberate and worth keeping: **seed as admin, assert as the
 * user.** A test may only ever REACH the state it needs via this path; it must
 * never use it to perform the behaviour under test, or it would be verifying
 * the privileged path rather than the one real users take.
 */
async function admin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: process.env.DATABASE_URL! });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Caller's auth uid — needed by the admin seeders, which have no session. */
async function testUserId(): Promise<string> {
  const { data } = await testClient.auth.getUser();
  return data.user!.id;
}

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
  await admin((c) => c.query(`delete from coin_ledger where ref_id = $1`, [refId]));
}

export async function cleanupTrackable(id: string) {
  // coin_ledger rows for completions are keyed by ref_id = completion.id, not
  // trackable id — so delete them via a subquery rather than a second round trip.
  await admin(async (c) => {
    await c.query(
      `delete from coin_ledger where ref_id in (select id from completions where trackable_id = $1)`,
      [id]
    );
    await c.query(`delete from completions where trackable_id = $1`, [id]);
  });
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
  await admin((c) => c.query(`delete from coin_ledger where ref_id = $1`, [id]));
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
  const uid = await testUserId();
  await admin((c) =>
    c.query(
      `insert into freeze_tokens (user_id, balance) values ($1, $2)
       on conflict (user_id) do update set balance = excluded.balance`,
      [uid, balance]
    )
  );
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

const OTHER_USER_PASSWORD = "OtherUser!2026Habiteer";
// Sequential per test-run so simultaneous "other users" (e.g. 4 league rivals)
// are distinct, while the emails are STABLE across runs — so we sign in and
// reuse the same handful of accounts forever instead of signing up a fresh
// throwaway every run (which used to pile up hundreds of dead auth users).
let otherUserCursor = 0;

/** A second, independent signed-up user — for group-membership / RLS / league
 * tests that need real rival accounts. Reuses a stable pool (buddy1, buddy2, …)
 * and resets that buddy's own data on acquire so reuse stays deterministic.
 * Returns a signed-in client + their user id. */
export async function makeOtherUser() {
  const slot = ++otherUserCursor;
  const email = `habiteer.rpctest.buddy${slot}@gmail.com`;
  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);

  let signIn = await client.auth.signInWithPassword({ email, password: OTHER_USER_PASSWORD });
  if (signIn.error) {
    // First time this slot is ever used: create it, then sign in.
    const signUp = await client.auth.signUp({ email, password: OTHER_USER_PASSWORD });
    if (signUp.error) throw signUp.error;
    // A project with "Confirm email" ON returns no session from signUp, so the
    // sign-in below would fail and take every buddy-account test with it. We own
    // the database, so confirm it here rather than depending on the project's
    // auth settings: turning confirmation OFF project-wide would let anyone sign
    // up with someone else's address in the real app, which is far too high a
    // price for green tests.
    await admin((c) =>
      c.query(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email = $1`, [email])
    );
    signIn = await client.auth.signInWithPassword({ email, password: OTHER_USER_PASSWORD });
    if (signIn.error) throw signIn.error;
  }
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user!.id;

  // Reset this buddy's own rows so a reused account starts clean each run
  // (RLS scopes these deletes to the buddy's own data). Completions before
  // trackables (FK). Best-effort — ignore anything RLS won't allow.
  for (const table of ["completions", "coin_ledger", "quest_claims", "league_standings", "freeze_tokens", "group_members"]) {
    await client.from(table).delete().eq("user_id", uid);
  }
  await client.from("trackables").delete().eq("user_id", uid);

  return { client, userId: uid };
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
  await admin((c) => c.query(`delete from coin_ledger where ref_id = $1`, [id]));
  await testClient.from("reward_contributions").delete().eq("reward_id", id);
  await testClient.from("rewards").delete().eq("id", id);
}

/** Clears the test user's quest claims + any 'quest' coin-ledger credits — call
 * after quest-claim tests so the once-per-week claim state doesn't leak. */
export async function cleanupQuests() {
  const uid = await testUserId();
  await admin(async (c) => {
    await c.query(`delete from quest_claims where user_id = $1`, [uid]);
    await c.query(`delete from coin_ledger where user_id = $1 and kind = 'quest'`, [uid]);
  });
}

/** Inserts a completions row directly, bypassing the RPC — for seeding streak
 * history. Admin-only since Phase S closed `completions` to client writes. */
export async function seedHistoricalCompletion(
  trackableId: string,
  isoDate: string,
  xp: number,
  coins: number,
  streakAfter: number
) {
  const uid = await testUserId();
  await admin((c) =>
    c.query(
      `insert into completions (trackable_id, user_id, completed_on, xp_earned, coins_earned, streak_after)
       values ($1, $2, $3, $4, $5, $6)`,
      [trackableId, uid, isoDate, xp, coins, streakAfter]
    )
  );
}

/** Test arrangement only — directly backdates the signed-in test user's
 * league standing, bypassing fn_sync_league(), so a test can arrange "as of
 * last week they were tier X" without needing a real multi-week history.
 * Admin-only since Phase S made league_standings SELECT-only for clients. */
export async function seedLeagueStanding(week: string, tier: string, xp = 0) {
  const uid = await testUserId();
  await admin((c) =>
    c.query(
      `insert into league_standings (user_id, week, tier, xp) values ($1, $2, $3, $4)
       on conflict (user_id, week) do update set tier = excluded.tier, xp = excluded.xp`,
      [uid, week, tier, xp]
    )
  );
}

export async function getLeagueStanding(): Promise<{ week: string; tier: string; xp: number } | null> {
  const { data: userData } = await testClient.auth.getUser();
  const { data, error } = await testClient
    .from("league_standings")
    .select("week, tier, xp")
    .eq("user_id", userData.user!.id)
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cleanupLeagueStandings() {
  const uid = await testUserId();
  await admin((c) => c.query(`delete from league_standings where user_id = $1`, [uid]));
}

/** Direct profiles update for the signed-in test user — the real client does
 * exactly this to equip a cosmetic (no RPC; the gate is the profiles RLS
 * WITH CHECK). Returns the raw Supabase response so tests can assert on error. */
export async function updateProfile(patch: { avatar_color?: string; title_id?: string; card_skin?: string; display_name?: string }) {
  const { data: userData } = await testClient.auth.getUser();
  return testClient.from("profiles").update(patch).eq("id", userData.user!.id);
}

export async function getProfileCosmetics(): Promise<{ avatar_color: string; title_id: string; card_skin: string }> {
  const { data: userData } = await testClient.auth.getUser();
  const { data, error } = await testClient
    .from("profiles")
    .select("avatar_color, title_id, card_skin")
    .eq("id", userData.user!.id)
    .single();
  if (error) throw error;
  return data as { avatar_color: string; title_id: string; card_skin: string };
}

/** Best-effort reset to level-1 defaults — call after any cosmetics test so a
 * seeded-then-cleaned-up high level never leaves the persistent account with a
 * cosmetic its (restored) level no longer unlocks, which would then block all
 * future profile updates via the WITH CHECK. Tolerant of the columns not yet
 * existing (the TDD red phase). */
export async function resetCosmetics() {
  const { data: userData } = await testClient.auth.getUser();
  await testClient
    .from("profiles")
    .update({ avatar_color: "violet", title_id: "novice", card_skin: "plain" })
    .eq("id", userData.user!.id);
}

/** A second real account with one completion dated inside `week` earning
 * `xp` — for league promotion/relegation tests that need real competing
 * weekly totals (fn_sync_league ranks against every user's actual completions,
 * not just the caller's, so proving the rank-based branches needs real rivals). */
export async function makeCompetitor(week: string, xp: number) {
  const { client, userId } = await makeOtherUser();
  const { data: t, error: tErr } = await client
    .from("trackables")
    .insert({
      user_id: userId,
      kind: "habit",
      name: "[TEST] competitor",
      emoji: "🧪",
      difficulty: "easy",
      coin_value: 10,
      period: "day",
      quota: 1,
    })
    .select()
    .single();
  if (tErr) throw tErr;

  // Admin-seeded: completions is SELECT-only for clients since Phase S, and
  // this rival's XP is pure test arrangement (it stands in for a real history).
  await admin((c) =>
    c.query(
      `insert into completions (trackable_id, user_id, completed_on, xp_earned, coins_earned, streak_after)
       values ($1, $2, $3, $4, 0, 1)`,
      [t.id, userId, week, xp]
    )
  );

  return {
    userId,
    cleanup: async () => {
      await admin((c) => c.query(`delete from completions where trackable_id = $1`, [t.id]));
      await client.from("trackables").delete().eq("id", t.id);
    },
  };
}

/** Admin sweep for a single ledger row by id. Exists so the economy-integrity
 * tests can clean up after themselves if a write they assert is IMPOSSIBLE ever
 * succeeds — otherwise a red run leaves forged coins in the shared account,
 * which is exactly what happened the first time those tests ran. */
export async function sweepLedgerRow(id: string) {
  await admin((c) => c.query(`delete from coin_ledger where id = $1`, [id]));
}

/** Funds the test account to at least `target` coins by completing throwaway
 * hard tasks (+26 each — `completions` is unique per trackable per day, so this
 * needs a distinct task per completion). Returns a cleanup for all of them.
 *
 * There is no seedCoins shortcut: coin_ledger is SELECT-only since Phase S, and
 * seeding it via the admin connection would bypass the very RPC path a staking
 * test wants funded through. Earning it for real is the honest arrangement. */
export async function fundCoins(target: number): Promise<() => Promise<void>> {
  const ids: string[] = [];
  while ((await ledgerBalance()) < target) {
    const t = await makeTrackable({ kind: "task", difficulty: "hard", name: "stake-funding" });
    ids.push(t.id as string);
    const { error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
    if (error) throw error;
  }
  return async () => {
    for (const id of ids) await cleanupTrackable(id);
  };
}

/** Admin-side pledge teardown: goals is SELECT-only, so a test can't delete its
 * own pledge rows, and the ledger rows are keyed by ref_id = goal.id. */
export async function cleanupPledges() {
  const uid = await testUserId();
  await admin(async (c) => {
    await c.query(
      `delete from coin_ledger where user_id = $1
         and kind in ('pledge','pledge_return','pledge_bonus','pledge_forfeit')`,
      [uid]
    );
    await c.query(`delete from goals where user_id = $1`, [uid]);
    await c.query(`delete from title_grants where user_id = $1`, [uid]);
    await c.query(`update profiles set title_id = 'novice' where id = $1`, [uid]);
  });
}

/** Creates a pledge directly (admin) so tests can arrange a mid-flight or
 * already-elapsed pledge without waiting real days. Bypasses fn_create_pledge
 * ON PURPOSE — the RPC refuses past windows — but never bypasses the RPC being
 * TESTED. Does not touch the ledger, so pair it with an explicit stake debit if
 * the test asserts on balance. */
export async function seedPledge(opts: {
  trackableId: string;
  targetCount: number;
  startsOn: string;
  endsOn: string;
  stakedCoins: number;
  state?: string;
  checkpointsBanked?: number;
}): Promise<string> {
  const uid = await testUserId();
  return admin(async (c) => {
    const { rows } = await c.query(
      `insert into goals (user_id, trackable_id, target_count, starts_on, ends_on,
                          staked_coins, state, checkpoints_banked)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [uid, opts.trackableId, opts.targetCount, opts.startsOn, opts.endsOn,
       opts.stakedCoins, opts.state ?? "active", opts.checkpointsBanked ?? 0]
    );
    return rows[0].id as string;
  });
}

/** Reads a pledge row as admin (goals is SELECT-only for the client, but the
 * client CAN read its own — this exists for reading state after settlement
 * without another round trip through PostgREST's shape). */
export async function getPledge(id: string) {
  return admin(async (c) => {
    const { rows } = await c.query(
      `select state, checkpoints_banked, staked_coins, settled_at from goals where id = $1`,
      [id]
    );
    return rows[0] as { state: string; checkpoints_banked: number; staked_coins: number; settled_at: string | null };
  });
}

/** Whether the test user currently holds a given earned title. */
export async function hasTitleGrant(titleId: string): Promise<boolean> {
  const uid = await testUserId();
  return admin(async (c) => {
    const { rows } = await c.query(
      `select 1 from title_grants where user_id = $1 and title_id = $2`,
      [uid, titleId]
    );
    return rows.length > 0;
  });
}
