# Server-authoritative mutations (Phase 2, Phase 4 freeze tokens, v2 groups — done)

Implemented as Postgres functions called via `supabase.rpc()` so XP/coin/streak/
ledger updates are atomic and tamper-proof. Tuning constants (difficulty base,
combo tiers, task discount, level curve) are generated from
`src/features/gamification/constants.ts` into `generated/constants.sql` by
`npm run db:gen-sql` — never hand-edit that file. Apply everything (generated
constants → `rls.sql` → `rpc.sql`) to the live dev database with
`npm run db:apply-sql`, which reads `DATABASE_URL` from `.env`.

`fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward`, and
`fn_contribute_to_reward` are all `SECURITY INVOKER` (the default — no special
clause): they rely entirely on the already-live RLS policies for ownership.
Calling any of them with an id you don't own resolves as "not found," not a
leaked read. `fn_join_group` and the `handle_new_group` trigger are the only
two `SECURITY DEFINER` exceptions in this codebase — see "Groups" below for
why each one needs to be.
"Today" is always `current_app_date()` — `(now() at time zone 'utc')::date` —
decided server-side, never from client input, so a client can't fake streaks
by lying about the date.

## `fn_complete_trackable(p_id uuid) returns jsonb`

`{ xp: int, coins: int, streak_after: int, freeze_tokens: int, level: { level, into_level, need } }`

- **habit**: streak = consecutive satisfied scheduled days ending today
  (mirrors `streak.ts`'s `currentStreak`, skipping unscheduled weekdays
  without breaking); `xp = round(difficulty_base * combo_multiplier(streak))`;
  `coins = coin_value` (flat, the habit's own editable field). The streak walk
  never looks further back than the trackable's own `created_at` — a day
  before it existed isn't a missed day, there was nothing to do.
- **task**: `coins = task_coins(difficulty)` (always derived fresh from
  difficulty — the fixed 8/15/26 — never from the row's own `coin_value`);
  `xp = 0`; the task is archived (`archived_at = now()`) in the same call.
- **Freeze tokens** (see below): a missed scheduled day is bridged instead of
  breaking the streak if a token is available; only habits can grant a token
  (crossing a level boundary — tasks always earn 0 XP).
- **Idempotent**: replaying a same-day completion (same `trackable_id` +
  `completed_on`) returns the originally recorded values without inserting
  again or touching the ledger. This check runs *before* the archived-at
  guard, so a same-day retry on a task returns the cached result rather than
  erroring "trackable is archived."
- Inserts one `coin_ledger` row, `kind = 'earn'`, `ref_id` = the new
  completion's id.

## `fn_undo_completion(p_id uuid) returns jsonb`

`{ xp: int, coins: int, freeze_tokens: int, level: {...} }` — the xp/coins
amounts reversed (negative).

- Finds today's completion for the trackable, deletes it, and inserts a
  compensating `coin_ledger` row (`kind = 'undo'`, `ref_id` = the completion's
  id, `delta = -coins_earned`) rather than deleting the original `'earn'` row
  — the ledger stays an append-only audit trail.
- Reverses whatever that completion did to the freeze balance (refunds a
  spent token, revokes a granted one) — see below.
- If the trackable is a task, un-archives it (`archived_at = null`),
  symmetric with complete's archive step.
- Raises if there's nothing completed today to undo.

## Freeze tokens (streak insurance)

Tuning: `FREEZE_TOKEN_LEVEL_INTERVAL = 5`, `FREEZE_TOKEN_MAX_BALANCE = 3`
(`src/features/gamification/constants.ts`, generated into
`freeze_token_level_interval()`/`freeze_token_max_balance()` — see
`tokensEarnedBetweenLevels()` for the client-side mirror of the same formula).

- **Spend**: in the streak walk, a scheduled day found not-done is bridged
  (streak keeps counting through it, no visible gap) if a token is available;
  once tokens run out, a gap still breaks the streak as before.
- **Earn**: `floor(level_after/5) - floor(level_before/5)`, comparing the
  level before vs. after this completion's XP — fires exactly at levels 5,
  10, 15, etc. Net change per completion = `-spent + granted`, clamped to
  `[0, cap]` (excess grants past the cap are simply not banked).
- **Auditability**: `completions.freeze_spent`/`freeze_granted` record what a
  *specific* completion did, so undo can precisely reverse it even though
  other completions may have touched the same balance since. `freeze_tokens`
  itself is a single mutable balance (`user_id primary key, balance int`),
  not a ledger — that's the shape PLAN.md's data model specifies.

## `fn_redeem_reward(p_id uuid) returns jsonb`

`{ balance: int }` — the new coin balance after redemption.

- Explicitly raises if `kind != 'personal'` — shared rewards go through
  `fn_contribute_to_reward` instead. This used to rely on RLS silently
  excluding shared rewards (their `user_id` was null, and the old policy was
  `user_id = auth.uid()`), but v2's "own or group rewards" policy now lets
  group members `SELECT` shared rewards too, so the check has to be explicit.
- Raises on: reward not found, not personal, already redeemed
  (`completed_at` set), or insufficient balance (`sum(delta) < cost`) — no
  partial deduction on failure.
- Inserts one `coin_ledger` row, `kind = 'redeem'`, `delta = -cost`.

## Groups (v2)

Two `SECURITY DEFINER` exceptions, both as narrow as possible — the only two
in this codebase:

- **`fn_join_group(p_code text) returns jsonb`** — `{ id, name, inviteCode }`.
  A non-member can't `SELECT` a group by invite code (RLS restricts that to
  existing members already), so the lookup-and-join has to bypass RLS to find
  it at all. Raises `'invalid invite code'` if the code doesn't match
  anything; idempotent if already a member (returns the group's info without
  a duplicate `group_members` row).
- **`handle_new_group()` trigger** (`after insert on groups`) — adds the
  creator to `group_members`. Needed for a subtler reason than "the creator
  should be a member": `supabase-js`'s `.insert().select()` issues
  `INSERT ... RETURNING`, and Postgres checks the table's **SELECT** policy
  against the returned row, not just `WITH CHECK` — evaluated in the same
  statement that fires this trigger, so the trigger's own insert isn't yet
  visible to that check. The `"member groups"` SELECT policy therefore also
  matches `created_by = auth.uid()` directly, so a creator can see the group
  they just made even before their membership row exists; the trigger still
  runs so every other group-scoped policy (rewards, contributions,
  re-fetching the group later) works purely off real `group_members` rows.
- **`my_group_ids()`** (`SECURITY DEFINER`, `returns setof uuid`) — every
  group-scoped RLS policy needs "which groups is the caller in," but a
  `group_members` policy can't subquery `group_members` in its own `USING`
  clause (Postgres re-enters the same policy and recurses forever — "infinite
  recursion detected in policy"). Routing through this definer function
  breaks the cycle: it runs as the function owner, which bypasses RLS for its
  own internal query instead of re-triggering the policy.
- **`caller_level()`** (`SECURITY INVOKER`) — `level_info()` applied to the
  caller's own total XP. Shared by the "level 3 to create a group / shared
  reward" gate (PLAN.md §9) on both the `groups` and `rewards` INSERT
  policies, so that literal threshold lives in one place server-side (the
  client mirrors it separately, in each screen that needs the "reach level 3"
  message, purely for UX — the RLS check is the real authority).

**`fn_contribute_to_reward(p_reward_id uuid, p_amount int) returns jsonb`**

`{ contributed, totalContributed, remainingBalance, unlocked }`.

- Raises on: reward not found, not `kind = 'shared'`, already unlocked
  (`completed_at` set), non-positive amount, caller not a member of the
  reward's group (a friendly raise instead of falling through to a raw RLS
  rejection on the `reward_contributions` insert), or insufficient balance —
  no partial contribution row on failure.
- Inserts one `coin_ledger` row (`kind = 'contribute'`, `delta = -p_amount`)
  and one `reward_contributions` row. Sets `completed_at = now()` once
  `sum(reward_contributions.amount) >= cost`.
- Any group member can create or contribute to a shared reward — there's no
  creator-only distinction (no `created_by` column on `rewards`); it reads as
  belonging to the group, not an individual.

## Known v1 gaps (accepted, not fixed)

- No advisory locking against concurrent double-complete/double-redeem races
  (TOCTOU on the balance check, or two near-simultaneous completes both
  passing the idempotency read before either commits — the latter is caught
  via a `unique_violation` fallback, the former isn't). Low-stakes for a
  single-user v1 app.
- `coin_ledger.ref_id` has no FK constraint (pre-existing, unrelated to this
  change).

## Testing

`src/lib/db/__tests__/rpc.test.ts` — integration tests against the live dev
Supabase project via `@supabase/supabase-js`, signed in as a persistent test
account (`TEST_USER_EMAIL`/`TEST_USER_PASSWORD` in `.env`). Each test creates
`[TEST]`-prefixed fixtures and cleans them up in a `finally` block — see
`testClient.ts` for the fixture helpers. Run with `npm test` alongside the
gamification unit tests.
