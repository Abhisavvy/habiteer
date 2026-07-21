# Server-authoritative mutations (Phase 2 — done)

Implemented as Postgres functions called via `supabase.rpc()` so XP/coin/streak/
ledger updates are atomic and tamper-proof. Tuning constants (difficulty base,
combo tiers, task discount, level curve) are generated from
`src/features/gamification/constants.ts` into `generated/constants.sql` by
`npm run db:gen-sql` — never hand-edit that file. Apply everything (generated
constants → `rls.sql` → `rpc.sql`) to the live dev database with
`npm run db:apply-sql`, which reads `DATABASE_URL` from `.env`.

All three functions are `SECURITY INVOKER` (the default — no special clause):
they rely entirely on the already-live RLS policies for ownership. Calling any
of them with an id you don't own resolves as "not found," not a leaked read.
"Today" is always `current_app_date()` — `(now() at time zone 'utc')::date` —
decided server-side, never from client input, so a client can't fake streaks
by lying about the date.

## `fn_complete_trackable(p_id uuid) returns jsonb`

`{ xp: int, coins: int, streak_after: int, level: { level, into_level, need } }`

- **habit**: streak = consecutive satisfied scheduled days ending today
  (mirrors `streak.ts`'s `currentStreak`, skipping unscheduled weekdays
  without breaking); `xp = round(difficulty_base * combo_multiplier(streak))`;
  `coins = coin_value` (flat, the habit's own editable field).
- **task**: `coins = task_coins(difficulty)` (always derived fresh from
  difficulty — the fixed 8/15/26 — never from the row's own `coin_value`);
  `xp = 0`; the task is archived (`archived_at = now()`) in the same call.
- **Idempotent**: replaying a same-day completion (same `trackable_id` +
  `completed_on`) returns the originally recorded values without inserting
  again or touching the ledger. This check runs *before* the archived-at
  guard, so a same-day retry on a task returns the cached result rather than
  erroring "trackable is archived."
- Inserts one `coin_ledger` row, `kind = 'earn'`, `ref_id` = the new
  completion's id.

## `fn_undo_completion(p_id uuid) returns jsonb`

`{ xp: int, coins: int, level: {...} }` — the amounts reversed (negative).

- Finds today's completion for the trackable, deletes it, and inserts a
  compensating `coin_ledger` row (`kind = 'undo'`, `ref_id` = the completion's
  id, `delta = -coins_earned`) rather than deleting the original `'earn'` row
  — the ledger stays an append-only audit trail.
- If the trackable is a task, un-archives it (`archived_at = null`),
  symmetric with complete's archive step.
- Raises if there's nothing completed today to undo.

## `fn_redeem_reward(p_id uuid) returns jsonb`

`{ balance: int }` — the new coin balance after redemption.

- RLS already excludes shared/group rewards (their `user_id` is null), so
  there's no explicit `kind = 'personal'` check.
- Raises on: reward not found, already redeemed (`completed_at` set), or
  insufficient balance (`sum(delta) < cost`) — no partial deduction on
  failure.
- Inserts one `coin_ledger` row, `kind = 'redeem'`, `delta = -cost`.

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
