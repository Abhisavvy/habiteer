# PROGRESS

## Phase 1 — Scaffold + Auth  (in progress)
Done
- Repo scaffold: Expo Router, TypeScript strict, path alias `@/`, Vitest.
- Supabase client with encrypted SecureStore session persistence.
- Auth: session gate (`app/_layout.tsx`), sign-in/up + Google screen.
- Drizzle schema for all v1 tables + RLS policies + weekly leaderboard view.
- Neobrutalist theme tokens ported from the prototype.

Blocked on you (external, one-time)
- Create Supabase project + Google OAuth credentials, fill `.env`, run `db:push` + `rls.sql`.
  Until then auth is code-complete but can't authenticate against a live backend.

## Phase 2 — Schema + gamification lib
Done early (pure logic, independently testable)
- Gamification core built **test-first**: 12 Vitest tests confirmed failing, then passing.
  - `comboMultiplier`, `xpForHabit`, `levelInfo`, `defaultCoinValue`, `taskCoins`,
    `currentStreak` (daily + specific-weekday scheduling).
- Tuning constants centralised in `constants.ts` (single source of truth).
Pending
- Postgres RPCs (`fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward`),
  validated against a local Postgres, mirroring the constants above (see `rpc.README.md`).

## Next
- Phase 3: daily view (habits + tasks), add/edit/archive.
- Phase 4: completion economy wired to RPCs (XP, coins, combo, level bar, freeze tokens).
- Phase 5: personal rewards + basic weekly leaderboard.
- v2: Android widget -> shared rewards/groups -> quota recurrence -> stats -> leagues -> cosmetics -> reduction mode.

## Bugs / blockers
- None.
