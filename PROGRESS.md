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

## Next
- Phase 3: daily view (habits + tasks), add/edit/archive.
- Phase 4: completion economy wired to RPCs (XP, coins, combo, level bar, freeze tokens).
- Phase 5: personal rewards + basic weekly leaderboard.
- v2: Android widget -> shared rewards/groups -> quota recurrence -> stats -> leagues -> cosmetics -> reduction mode.

## Bugs / blockers
- None blocking. See "Known follow-ups" above for accepted v1 gaps.
