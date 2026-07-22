# PROGRESS

## Phase 1 — Scaffold + Auth  (done)
Done
- Repo scaffold: Expo Router, TypeScript strict, path alias `@/`, Vitest.
- Supabase client with encrypted SecureStore session persistence.
- Auth: session gate (`app/_layout.tsx`), sign-in/up + Google screen.
- Drizzle schema for all v1 tables + RLS policies + weekly leaderboard view.
- Neobrutalist theme tokens ported from the prototype.
- Supabase project created, `.env` filled in, schema pushed (`drizzle.config.ts` added — was
  missing from scaffold), RLS applied via `rls.sql`.
- GitHub repo created (private): github.com/Abhisavvy/habiteer.
- Verified end-to-end on a physical Android device via Expo Go (SDK 54, matched to the
  installed Expo Go version — project originally resolved to SDK 57 wildcard deps, downgraded).
- Email/password sign-up + sign-in confirmed working against the live Supabase backend.
  "Confirm email" is currently OFF in Supabase (dev convenience — Supabase's default/no-SMTP
  email sender is rate-limited and confirmation emails weren't arriving). Re-enable and/or set
  up a real SMTP provider (Resend etc.) before real users sign up.

Scaffold bugs found + fixed this session
- Missing deps not declared in `package.json`: `expo-constants`, `react-native-url-polyfill`
  (used by `src/lib/supabase/client.ts`), `pg`/`dotenv` (used by `drizzle.config.ts`), `@types/react`.
- `constants/theme.ts` lived at repo root but `tsconfig.json`'s `@/*` alias maps to `src/*` —
  moved to `src/constants/theme.ts` to match every existing `@/constants/theme` import.
- `react-native-screens@4.17+` crashes immediately on Android under Expo SDK 54
  ("java.lang.String cannot be cast to java.lang.Boolean") — pinned to `4.16.0`.
- Google OAuth in `sign-in.tsx` never opened a browser (`signInWithOAuth` on RN just returns
  a URL, doesn't auto-navigate) — fixed using `expo-web-browser`'s `openAuthSessionAsync` +
  `expo-auth-session`'s `QueryParams` to exchange the redirect for a session.
- Google sign-in itself still blocked on this device: Google Cloud OAuth consent screen is in
  "Testing" mode and the test Google account wasn't added to the Test users list. Not fixed —
  parked in favor of email/password for now.
- `withEmail` in `sign-in.tsx` extracted `supabase.auth.signInWithPassword`/`signUp` as a bare
  reference (`const fn = supabase.auth.signInWithPassword; fn(...)`), losing its `this` binding
  and crashing (`this._returnResult is not a function`). Fixed to call the methods directly.
- Same function had no `try/finally` around `setBusy(false)` — a thrown error left the
  Sign in / Create account buttons permanently disabled until app restart. Fixed.

Known follow-ups (not blocking)
- Google sign-in: add the test Google account in Cloud Console, or drop the Google option
  from v1 if not needed.
- Re-enable "Confirm email" (and ideally configure real SMTP) before any real user signs up.
- Cross-device login (the literal Phase 1 exit criteria) not yet tested on a second device —
  should just work given the same Supabase backend, but hasn't been explicitly verified.

## Phase 2 — Schema + gamification lib
Done early (pure logic, independently testable)
- Gamification core built **test-first**: 12 Vitest tests confirmed failing, then passing.
  - `comboMultiplier`, `xpForHabit`, `levelInfo`, `defaultCoinValue`, `taskCoins`,
    `currentStreak` (daily + specific-weekday scheduling).
- Tuning constants centralised in `constants.ts` (single source of truth).
Pending
- Postgres RPCs (`fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward`),
  validated against a local Postgres, mirroring the constants above (see `rpc.README.md`).

## Phase 2 — Postgres RPCs (done)
Done
- `fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward` implemented in
  `src/lib/db/rpc.sql`, applied to the live dev DB via `npm run db:apply-sql`.
  See `rpc.README.md` for exact return shapes and semantics.
- Tuning constants generated into SQL from `src/features/gamification/constants.ts`
  by `scripts/gen-sql-constants.ts` (`npm run db:gen-sql`) — never hand-copied, so
  client projections and server truth can't drift (per CLAUDE.md/PLAN.md §6).
  Required a small prep refactor: `LEVEL_XP_BASE`/`LEVEL_XP_EXPONENT` exported from
  `constants.ts` (previously inlined literals in `xp.ts`'s private `reqFor`).
- 14 new Vitest integration tests in `src/lib/db/__tests__/rpc.test.ts`, run against
  the live dev Supabase project via a persistent test account (no local
  Postgres/Docker available in this environment). All 26 tests (12 unit + 14
  integration) green, run twice back-to-back to confirm test fixtures clean up
  completely with no leftover rows.
- Bundled fixes found while implementing:
  - **No `profiles` row was ever created on sign-up** (no auth trigger existed) —
    every `trackables`/`rewards` insert failed its FK constraint for *any* user,
    not just tests. This would have blocked Phase 3 immediately. Fixed with the
    standard Supabase `handle_new_user()` trigger on `auth.users`, plus a one-time
    backfill for users created before the trigger existed (`rls.sql`).
  - `profiles` had no RLS at all — any logged-in user could read/write anyone's
    `display_name`/`avatar`. Added an owner-only policy alongside the above.
  - No table's `check in (...)` constraints from PLAN.md §5's data-model docs were
    ever actually implemented in `schema.ts` — descriptive comments only, not real
    Postgres CHECK constraints. Added one for `coin_ledger.kind` (needed for the
    `'undo'` value); the others (`trackables.kind`/`difficulty`, `rewards.kind`)
    are still unconstrained at the DB level — flagged, not fixed, out of scope here.

Known follow-ups (not blocking)
- No advisory locking against concurrent double-complete/double-redeem races
  (single-user v1 app, low-stakes; documented in `rpc.README.md`).
- `trackables.kind`/`difficulty` and `rewards.kind` still have no real CHECK
  constraint at the DB level (see above).

## Phase 3 — Trackables: daily view + add/edit/archive (done)
Done
- `app/index.tsx` replaced the placeholder with the real daily view: habits +
  tasks in one list, add/edit via an inline panel (`TrackablePanel`), archive
  via an X icon (soft-delete, `archived_at`).
- `src/features/trackables/`: `api.ts` (plain Supabase CRUD, RLS-protected,
  no RPC needed — RPCs are only for the completion economy), `schemas.ts`
  (drizzle-zod validation — first real use of that locked architecture
  decision), `useTrackables.ts` (TanStack Query — also first real use;
  `QueryClientProvider` added to `app/_layout.tsx`), `today.ts` (pure
  due-today filter, built test-first, reuses the existing tested `weekday()`
  helper from the gamification lib).
- Scheduling UI beyond the old prototype: "Every day" vs "Specific days"
  toggle + a 7-day multi-select for habits; tasks get no scheduling UI.
- Added `lucide-react-native` + `react-native-svg` for icons (Pencil/X/Plus/
  LogOut), matching the prototype's icon set.
- Scope check confirmed with the user: no check/complete button yet — every
  card always shows a streak-0 projection. That's Phase 4's job (wiring the
  already-built RPCs to a real check button + XP/level bar).
- Fixed the `@/` path-alias not resolving under Vitest (only Metro understood
  it) — added `resolve.alias` to `vitest.config.ts`, benefits every test file
  going forward, not just this phase's.
- 3 new Vitest tests for `filterDueToday` (29 total, all green); `tsc --noEmit`
  clean project-wide.
- Verified live on device: add (daily + specific-weekday habit + task), edit,
  archive all confirmed working by the user.

Known follow-ups (not blocking)
- No unarchive UI (matches confirmed v1 scope; archived rows still exist in
  the DB, just not reachable from the app).
- Editable `coin_value` resets to the difficulty default whenever the effort
  button is tapped in the add/edit panel (simplest predictable behavior for
  v1; a user who wants a custom value picks effort first, then edits coins).

## Phase 4 — Completion economy (done)
Done
- Check/undo button wired to `fn_complete_trackable`/`fn_undo_completion` on
  every `TrackableCard`; streak flame + combo badge now shown (deliberately
  omitted in Phase 3 since they'd always have been meaningless zeros).
- Level bar, coin balance, and freeze-token badge in the header
  (`src/features/completions/`: `api.ts`, `derived.ts` — pure, tested,
  reuses `currentStreak`/`comboMultiplier`/`levelInfo` from the gamification
  lib — and `useCompletions.ts`).
- Floating "+N XP" text and a level-up overlay, ported from the old
  prototype's animations (`FloatingXp.tsx`, `LevelUpOverlay.tsx`), per
  PLAN.md §1's "every action must pay off visibly" thesis.
- Completing a task shows a "Done ✓ — Undo" toast (`UndoToast.tsx`) since
  it auto-archives and leaves the list immediately, so there's no card left
  to tap otherwise.
- **Freeze tokens** (scope resolved with the user — PLAN.md's own docs
  disagreed on v1/v2, went with the 3-of-4-references majority): 1 earned
  every 5 levels, capped at 3 banked; automatically bridges a missed
  scheduled day instead of breaking the streak. New `freeze_tokens` table +
  `completions.freeze_spent`/`freeze_granted` columns (Drizzle migration);
  `tokensEarnedBetweenLevels()` pure function mirrors the same formula
  generated into SQL, so client and server can't drift.
- 12 new tests (5 RPC integration + 4 `freeze.ts` + 3 `derived.ts`; 41 total,
  all green); `tsc --noEmit` clean.

Bugs found + fixed this session
- **Real logic bug**: the streak walk had no concept of a trackable's own
  `created_at`, so a brand-new habit's first-ever completion could treat
  "yesterday" (before the habit existed) as a missed day. Harmless before
  freeze tokens (breaking on a fake gap and a real one looked identical), but
  freeze-bridging made it visibly wrong (a token could be spent bridging a
  day that was never real). Fixed: the walk now stops at `created_at`,
  neither breaking nor bridging past it.
- **Test-isolation gap**: `freeze_tokens` is global per-user mutable state,
  not scoped to any one trackable, so a leftover balance from an earlier
  test (or an earlier *failed* run) silently leaked into unrelated tests.
  Fixed with a `beforeEach` that resets the test user's balance to 0 before
  every test; only the tests that actually exercise freeze tokens set their
  own balance explicitly.
- **Network**: `DATABASE_URL`'s direct-connection hostname started resolving
  IPv6-only, and this network has no IPv6 route — `scripts/apply-sql.ts`
  stopped working entirely. Switched to Supabase's session pooler connection
  string (IPv4-compatible). Unrelated to the app itself, but worth knowing if
  `db:apply-sql`/`db:push` ever mysteriously stop working again.
- **Dev-loop**: after the Mac woke from sleep, its LAN IP changed subnets and
  the phone couldn't reach it (Expo Go: "Failed to download remote update").
  Switched to `npx expo start --tunnel` (routes through the internet, not
  local network) — more reliable going forward, worth defaulting to it.

Known follow-ups (not blocking)
- No advisory locking against concurrent double-complete/double-redeem races
  (documented in `rpc.README.md`); balance-checks predate this phase.
- `trackables.kind`/`difficulty` and `rewards.kind` still have no real CHECK
  constraint at the DB level (found in Phase 2, still not fixed).

## Phase 5 — Personal rewards + basic weekly leaderboard (done — v1 complete)
Done
- **Real bottom-tab navigation** (confirmed with user over the old
  prototype's in-page toggle): `app/(tabs)/` — Today (moved from
  `app/index.tsx`, unchanged), Rewards, Ranks. `app/_layout.tsx`'s
  post-auth redirect now targets `/(tabs)`.
- `src/features/rewards/`: mirrors `src/features/trackables/`'s exact
  layered structure (`schemas.ts` via drizzle-zod, `api.ts`,
  `useRewards.ts`, `RewardCard`/`RewardPanel`). Redeeming calls the
  already-tested `fn_redeem_reward` RPC from Phase 2 — no new backend
  logic needed this phase at all, confirmed by reading the live DB
  directly: `weekly_leaderboard` (created in Phase 1's `rls.sql`, never
  used until now) already has the right grants and already bypasses
  per-row RLS correctly (created without `security_invoker`, Postgres
  default `false`), so it was ready to query as-is.
- `src/features/leaderboard/`: reads `weekly_leaderboard` directly (no
  RPC — it's a read, matches the "reads via RLS-protected queries"
  architecture split), highlights the signed-in user's own row as "You".
- Verified live on device: add/redeem a reward (coins deduct, reward
  disappears), the insufficient-funds error surfaces cleanly on an
  intentionally-expensive one, leaderboard shows the account correctly.
- No new pure logic this phase (rewards CRUD + leaderboard read are both
  thin wiring over already-tested pieces) — no new test suites; existing
  41 stayed green throughout, `tsc --noEmit` clean.

**v1 is now feature-complete** per PLAN.md §13's phase list (accounts +
cross-device, habits + tasks, XP/coins/combo/levels/freeze tokens, personal
rewards, basic weekly leaderboard). Known follow-ups below are accepted gaps,
not blockers.

Known follow-ups (not blocking)
- No unarchive UI for rewards either (same accepted gap as trackables from
  Phase 3) — un-redeemed rewards can only be deleted, not un-deleted.
- Leaderboard has no seed/fake data — with few real accounts registered, it
  may show just one or two rows for a while. Expected, not a bug.

## Next
- v2, in priority order per PLAN.md §13: Android home-screen widget → shared
  rewards/groups → week/month quota recurrence → gamified stats page →
  league tiers → cosmetics/unlocks → reduction mode.

## Bugs / blockers
- None blocking. See "Known follow-ups" above for accepted v1 gaps.
