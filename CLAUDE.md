# Habiteer — project context for Claude Code

Gamified habit + task tracker. Expo (React Native) client + Supabase backend. Android-first, free stack.

**Read first, in order:** `PLAN.md` (all design decisions — settled — + v1/v2 roadmap) → `PROGRESS.md` (current status) → `README.md` (setup).

## Current state
- **Phase 1 (scaffold + auth):** code-complete; BLOCKED on the user creating a Supabase project + Google OAuth and filling `.env` (see README). Auth cannot run until then.
- **Gamification core:** DONE, built test-first — 12 Vitest tests green in `src/features/gamification/`.
- **Immediate next task:** Phase 2 Postgres RPCs — `fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward` — spec in `src/lib/db/rpc.README.md`.

## Working protocols (do not skip)
- **TDD:** write Vitest/Pytest tests first, confirm they FAIL, then implement to green.
- **Plan Mode:** any task touching >3 files → write a short scoped plan and wait for `GO`/`APPROVED` before editing code.
- **PROGRESS.md:** update after every significant task (done / pending / bugs).
- **Layout:** everything under `src/features/[feature-name]/`.
- **Docs:** JSDoc on all exported functions; inline comments for non-obvious math.
- **Style:** PascalCase components, camelCase variables, Clean Code.
- **Versions:** latest stable; align native deps with `npx expo install --fix`.
- **Single source of truth:** tuning constants live in `src/features/gamification/constants.ts`. The Postgres RPCs MUST mirror these values exactly — the server is authoritative, but it has to agree with the tested TS lib. Treat divergence as a breaking bug.
- **Security:** never put secrets or PII in the client bundle or URLs; user data is protected by RLS; only the anon key ships client-side.

## Commands
- `npm test` — gamification tests
- `npm run db:generate && npm run db:push` — Drizzle migrations (then run `src/lib/db/rls.sql` in the Supabase SQL editor)
- `npx expo start` — dev server (press `a` for Android)

## Scope guard
**v1** = accounts + cross-device, habits (daily/weekdays) + tasks, XP/coins/combo/levels/freeze tokens, personal rewards, basic weekly leaderboard.
**v2** (do not pull forward without the user's say-so) = Android home-screen widget → shared rewards + groups → week/month quota recurrence → gamified stats page → league tiers → cosmetics/unlocks → reduction mode.
Full detail: `PLAN.md` §13.
