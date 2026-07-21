# Server-authoritative mutations (Phase 2)

Implemented as Postgres functions called via `supabase.rpc()` so XP/coin/streak/
ledger updates are atomic and tamper-proof. To be written and validated against a
local Postgres in Phase 2, mirroring the tuning constants from
`src/features/gamification/constants.ts` (single source of truth).

- `fn_complete_trackable(p_id uuid)` -> { xp, coins, streak_after, level }
  - habit: streak from prior completions + schedule; xp = base x combo; coins = coin_value (flat)
  - task:  coins = round(base x 0.75); xp = 0; archive the task
  - inserts completion (UNIQUE trackable_id, completed_on -> idempotent) + ledger 'earn'
- `fn_undo_completion(p_id uuid)`  -> reverses today's completion + ledger entry
- `fn_redeem_reward(p_id uuid)`    -> balance check -> ledger 'redeem'
