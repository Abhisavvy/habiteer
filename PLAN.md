# PLAN.md — Habiteer

A gamified habit + task tracker. Real accounts, cross-device sync, an Android home-screen widget, and an XP/coin economy tuned so that showing up consistently is always the winning move.

**Status: awaiting `GO`.** No application code is written until you approve. This supersedes all earlier drafts.

---

## 1. Product thesis

Make hard-to-keep chores easy to reach and fun to do. Two things carry that: it must be **one tap from the home screen** (the widget), and every action must **pay off visibly** (XP, coins, streaks, level, league). If either fails, it becomes another dead tracker.

The core loop: **do a habit/task → earn XP + coins → XP levels you up & climbs the league → coins buy a reward you actually want.** The reward you're grinding toward (a 500-coin dinner when you earn ~25/day) is the tension that makes the daily action worth it.

---

## 2. Design decisions (locked)

| # | Decision | Rule |
|---|---|---|
| 1 | **Objects** | **Habits** (recurring, hold streaks, feed combos, earn XP + coins) · **Tasks** (one-off, no streak, coins only) · **Rewards** (spend coins). Habits + tasks share one daily view so nothing is forgotten. |
| 2 | **Task pay** | 75% of a same-effort habit's base coins, rounded: Easy **8**, Medium **15**, Hard **26**. No XP, no multiplier. |
| 3 | **Recurrence** | One model: **period (day / week / month) + quota** (default 1). A streak = **consecutive satisfied periods** — one unit everywhere. |
| 4 | **v1 recurrence** | Daily + specific-weekdays only (period = day). Week/month quota patterns switch on in v2 (already designed in). |
| 5 | **Combo** | Streak multiplier applies to **XP only**. Coins stay flat, so reward costs remain a stable target. Tiers (in satisfied periods): ≥3 ×1.2, ≥7 ×1.5, ≥14 ×2, ≥30 ×3. |
| 6 | **Levels** | Grant status, cosmetics, capability unlocks, and freeze tokens. **Zero coins** — the economy stays sealed. |
| 7 | **Long game** | Weekly **leagues** (Bronze → …) with promotion/relegation. **No personal resets, ever.** |
| 8 | **Scope** | Tight v1 that proves the loop cross-device; everything social/advanced is phased v2. See §13. |

Base values: Easy = 10, Medium = 20, Hard = 35 (habit base coins default to these and are user-editable per habit; XP base is the same scale). Level curve: cumulative, `reqFor(level) = round(100 × level^1.3)`.

---

## 3. Architecture

Client pivots to native (a web app cannot render an Android home-screen widget); the backend is unchanged and client-agnostic.

- **Client:** **React Native via Expo** (Expo Router for file-based navigation — same mental model as Next.js App Router), TypeScript strict. Chosen because your React/TS skills transfer directly and one codebase covers Android now + iOS later.
- **Backend:** **Supabase** — Postgres + Auth + Realtime + Row-Level Security, all on the free tier.
- **No separate API server.** The app talks to Supabase directly (reads via RLS-protected queries) and runs all *mutating game logic* — complete, undo, redeem, contribute — inside **Postgres functions called via `supabase.rpc()`**, so XP/coin/streak/ledger updates are atomic and authoritative. This keeps the whole thing free (nothing extra to host) and prevents client tampering.
- **Client state:** Zustand (session/UI) + TanStack Query (server data). Session token stored in `expo-secure-store`.
- **Validation:** Zod DTOs, derived from the Drizzle schema via `drizzle-zod` (single source of truth). Drizzle also owns migrations.
- **Design:** port the prototype's neobrutalist tokens/animations into React Native styles (shadcn/framer-motion were web-only and are dropped).

---

## 4. Platform & cost — confirmed $0

- **Android (v1 target):** build the APK (Expo EAS free tier, or local Gradle — no Mac required), install directly on your device, share the APK with friends. Home-screen widget works from a sideloaded app. Google Play's $25 is only for public store listing — not needed.
- **iOS (deferred):** the same Expo code runs on iOS, but a real iOS widget needs App Groups, which require Apple's $99/yr programme, so **iOS is not a v1 target and gets no widget.** If you ever pay, the app (not the widget) lights up from the same codebase.
- **Backend:** Supabase free tier — 500 MB Postgres, 50k MAU, auth, realtime. Add a free scheduled GitHub Actions `pg_dump` for backups (free tier has none).

Net: database, app, and Android widget cost nothing.

---

## 5. Data model (Postgres)

```
profiles            id uuid PK (= auth.users.id), display_name, avatar, created_at

trackables          -- habits and tasks share a table, split by `kind`
  id uuid PK, user_id FK, kind text check in ('habit','task'),
  name, emoji, difficulty text check in ('easy','medium','hard'),
  coin_value int not null,            -- editable; defaults to base for the difficulty
  period text null check in ('day','week','month'),   -- habits only
  quota int not null default 1,        -- habits only
  weekdays int[] null,                 -- habits, specific-weekday schedules (0-6)
  archived_at timestamptz null, created_at

completions
  id uuid PK, trackable_id FK, user_id FK,
  completed_on date not null,
  xp_earned int not null, coins_earned int not null, streak_after int not null,
  created_at
  UNIQUE (trackable_id, completed_on)  -- one completion per habit per day; idempotent

coin_ledger          -- single source of truth for balance
  id uuid PK, user_id FK, delta int, kind text check in ('earn','redeem','contribute'),
  ref_id uuid, created_at
  -- balance(user) = sum(delta)

rewards
  id uuid PK, kind text check in ('personal','shared'),
  name, emoji, cost int,
  user_id uuid null,   -- personal owner
  group_id uuid null,  -- shared (v2)
  completed_at timestamptz null, created_at

-- v2 tables
reward_contributions  id, reward_id FK, user_id FK, amount int, created_at
groups                id, name, invite_code, created_by, created_at
group_members         group_id FK, user_id FK, joined_at
freeze_tokens         user_id FK, balance int
league_standings      user_id FK, week date, xp int, tier text
```

RLS: `trackables`, `completions`, `coin_ledger`, `rewards` are readable/writable only where `user_id = auth.uid()`. The leaderboard/league reads a `security definer` view exposing only `display_name`, `avatar`, and weekly XP — never raw data.

---

## 6. Game logic & single source of truth

- **Tuning constants** (difficulty values, task discount, combo tiers, level curve) live in **one shared module** and are mirrored into the Postgres functions via a generated SQL constants file, so client projections and server truth never drift.
- **Pure TS lib** (`features/gamification/lib`) computes *display projections* — "completing this now pays +40 XP / +20 coins." The **Postgres RPC functions** compute the *authoritative* result on write. Server always wins.
- **TDD:** every function in the gamification lib gets Vitest tests **written first, confirmed failing, then implemented** — `levelInfo`, `comboMult`, coin calc, `streakFromCompletions`, period/quota window, insufficient-funds guard.

---

## 7. Recurrence & streak engine

One model — `period + quota`:

- **Daily** → period day, quota 1
- **Specific weekdays** → period day, `weekdays` set; off-days never count as misses
- **3×/week** → period week, quota 3 *(v2)*
- **Monthly** → period month, quota 1 *(v2)*

Streak = consecutive **satisfied** periods. Breaks only on a missed scheduled day, an under-quota week, or a skipped month. A freeze token can save one missed period. v1 ships day + weekdays; the week/month code paths are stubbed behind the same model.

---

## 8. Economy

- **XP** — never spent; drives level + league. Combo multiplies it, so consistency compounds into fast progression.
- **Coins** — spent on rewards; **flat**, never multiplied, so a 500-coin reward stays ~3 weeks of daily effort — a designable, stable target.
- **Habit** completion: `coins = coin_value` (flat) and `xp = base × comboMult(streak)`.
- **Task** completion: `coins = round(base × 0.75)`, `xp = 0`, no multiplier.
- **Personal reward** redeem: balance check → ledger `-cost`. **Shared reward** (v2): members contribute → pool fills → unlocks at target.

---

## 9. Progression & long game

- **Every level:** number rises + leaderboard/league movement.
- **Milestone cosmetics (Lv 5/10/20…):** themes, avatars, card skins, titles.
- **Capability unlocks (front-loaded):** Lv 2 custom colors · Lv 3 create groups + shared rewards · Lv 5 more habit slots / advanced recurrence.
- **Freeze tokens:** earned every few levels, small cap; spend to save a streak. The perk that protects the engine that produces it.
- **Leagues (v2):** weekly tiers with promotion/relegation on the leaderboard — the renewable "why show up Monday," since levels eventually plateau. No personal progress ever resets.

---

## 10. The Android widget (first v2 phase — architected for from day one)

- **Library:** `react-native-android-widget` (Expo config-plugin support) — build the widget UI in TS/JSX.
- **Data:** the app writes a small "today snapshot" (habits/tasks due, done state, coin balance, top streak) to Android shared storage; the widget renders from it. Interactions are **tappable, not scrollable**.
- **Quick action:** tap a habit on the widget → optimistic complete → enqueue a Supabase sync (via the same RPC), snapshot refreshes. This is the "one tap from the home screen" that the whole product hinges on.
- Because it's an extension of a working app, it comes right after the v1 loop — but the sync/snapshot layer is designed in v1 so it isn't a retrofit.

---

## 11. Gamified stats page (v2)

A read-only layer over data v1 already records — no new writes, no economy risk. Per-habit and account-wide: completion rate, current vs **longest streak (and which habit holds it)**, missed periods, coins earned over time, level history, best league finish. Framed as achievements/records ("beat your longest streak"), feeding the same long-game motivation.

---

## 12. App structure (`src/features/[feature]/`)

```
features/auth/          sign-in/up, Supabase session, secure-store
features/trackables/    habit + task list, daily view, add/edit, HabitCard, TaskCard  [ported UI]
features/gamification/  lib/ (xp, comboMult, streak, period, coins) + __tests__ (TDD)
features/coins/         balance, ledger view
features/rewards/       personal rewards (redeem); shared rewards (v2)
features/leaderboard/   weekly board (v1) → leagues (v2)
features/widget/        Android widget UI + snapshot sync (v2)
features/stats/         gamified stats (v2)
features/groups/        groups + invite codes (v2)
lib/db/                 Drizzle schema, migrations, RPC function SQL
lib/supabase/           client, RLS helpers
```
Conventions: PascalCase components, camelCase vars, JSDoc on exports, `PROGRESS.md` updated after each phase.

---

## 13. Build phases

**v1 — prove the loop, cross-device, free on Android — done**
1. **Scaffold + auth** *(done)* — Expo app, Supabase project, email/password + Google sign-in, session persists across devices. *Exit: log in on two devices, same account.*
2. **Schema + gamification lib** *(done)* — Drizzle schema, migrations, RLS; TS lib with **Vitest tests first**.
3. **Trackables** *(done)* — habits (daily + weekdays) & tasks; daily view; add/edit/archive.
4. **Completion economy** *(done)* — RPC complete/undo (atomic, idempotent), XP + coins + combo, level bar + freeze tokens, coin balance/ledger.
5. **Personal rewards + basic leaderboard** *(done)* — redeem flow (closes the dinner loop solo); global weekly board.

**v2 — in priority order**
6. **Android home-screen widget** *(done — light + dark, device-verified)*
7. **Shared rewards + groups + invite codes** *(done)*
8. **Week/month quota recurrence** (3×/week, monthly) *(done)*
9. **Gamified stats page** *(done — per-habit completion rate/streaks/coins earned, an 8-week coins-earned chart, and which habit holds the longest streak, on a new `app/stats.tsx` screen reached from Profile. Best league finish and level history are explicitly excluded — see `PROGRESS.md` — blocked on item 10 and on there being no stored historical level snapshots to reconstruct from, respectively.)*
10. **League tiers** (promotion/relegation) *(done — 5 tiers, Bronze→Diamond, rank-based promotion/relegation on the existing global weekly leaderboard rather than a separate cohort system. No server-side cron exists on this $0-cost stack, so the weekly rollover is a lazy, per-user, idempotent-per-week RPC (`fn_sync_league`) triggered on the Board screen's mount instead. Full design reasoning and verification in `PROGRESS.md`.)*
11. **Cosmetics catalog + capability unlocks** *(done — milestone-gated avatar colors + titles, equippable from a new `app/cosmetics.tsx` screen reached from Profile; equipped color drives the Profile + Today-header avatars, title shows under the name. Capability unlocks (Lv 3 groups, Lv 5 recurrence) already shipped in earlier phases as `caller_level()` RLS gates; the cosmetics gate follows the same pure-RLS-WITH-CHECK pattern (no RPC — an RPC would be bypassable via a direct profiles update). Card skins + full themes + "more habit slots" scoped out — see `PROGRESS.md`.)*
12. **Reduction mode** (optional — coins toward abstaining instead of indulging) *(done — shipped as "simple abstention": a `goal_type` build/reduce flag on trackables; a reduce habit reuses the whole completion/streak/coin engine and only reframes copy (RESISTED ✓ / 🛡️ / a REDUCE pill). Batched with three core-loop fixes the user raised: undo unified to a transient toast then locked-for-the-day, day-reset on foreground via focusManager, and optional per-task scheduled days (`due_on`). Code-complete + tsc/test-verified; device verification deferred by the user. See `PROGRESS.md`.)*

**The numbered v2 roadmap (items 1–12) is now complete.** Everything above plus the ad hoc UX/UI redesign has shipped. A post-roadmap **Phase 13 — "cosmetics tails"** then built the two pieces Phase 11 explicitly deferred (the user's pick): surfacing others' equipped avatar-color/title on the Board, and one account-wide card skin (light-tint, level-gated exactly like avatar_color/title_id). Code-complete + `tsc`/`vitest`-verified; see `PROGRESS.md`. What remains across Phases 11–13: an on-device screenshot pass (user deferring) and a commit of the pending working tree (Phases 11, 12, 13 all uncommitted).

**v3 (post-roadmap, competitor-gap driven).** A source-verified deep-research pass over gamified competitors (Finch, Duolingo, Habitica, …) ranked the top additive gaps. The first v3 batch shipped **habit reminders** (gap #1 — on-device `expo-notifications`, a `reminder_time` per trackable, preset+stepper picker, master toggle on Profile; $0, no server) and the long-stubbed **sounds & haptics** (`expo-haptics` + `expo-audio` with 3 synthesized WAV cues; wires up the previously-dead Profile toggles). TDD'd pure scheduler (`reminders/schedule.ts`, 11 cases), `tsc`/`vitest` green (115 passing), RLS re-verified after the column's `db:push`. Needs a native rebuild + device pass before it runs; detail in `PROGRESS.md`. Then **Gap #3 (relationship social)** shipped as a **group shared streak** — a group's streak counts consecutive days every member showed up, via a security-definer `fn_group_activity` RPC (activity days only, RLS-safe) + a TDD'd `groupStreak()` and a streak banner + per-member today-status on the group screen. The research's other streak lever (auto-apply freeze on a miss) was already built into `fn_complete_trackable`. Then **weekly quests + limited-time events** (the urgency lever) shipped: a `QUESTS` catalog (constants → mirrored SQL), progress derived from this week's completions, a server-authoritative `fn_claim_quest` crediting a one-time **coins-only** reward per ISO week (idempotent via a `quest_claims` table), events as optional date-windowed quests, and an `app/quests.tsx` screen reached from the Board. Remaining research gaps not yet built: economy multipliers + auto-rotating events (need cron / touch the hot payout path), and the companion/pet attachment layer (biggest lift).

**Ad hoc, inserted after item 8 — v2 UX/UI redesign** (a full visual restyle + a few new screens/systems, commissioned separately mid-v2 and not part of the numbered list above): app icon/fonts/splash, Today + add/edit panel restyle, a 5-tab bottom HUD with a raised context-aware "+" button, a new **Profile** screen (the piece that overlaps with item 9 above), a shared modal system, Rewards celebration + Leaderboard ("Board") redesign, overlay polish + widget dark mode, and a follow-up restyle of Groups/shared-rewards (the one screen set the design predated entirely). **All 5 phases (A–E) done, plus the Groups follow-up, plus a device-verification pass that found and fixed two real cross-cutting bugs (hard shadows never rendering on Android; the splash/sign-in screens not matching the final icon) — all device-verified, nothing left to build.** Full detail and exact-spec provenance in the plan file `toasty-wibbling-treasure.md`; rollup in `PROGRESS.md`.

Plan Mode note: any phase touching >3 files gets its own short pre-flight check-in; `PROGRESS.md` tracks completed/pending/blockers throughout.

---

## 14. What I need from you to start

1. **`GO`** to build v1 as scoped.
2. **Sign-in:** email/password + Google for v1 — or email/password only to start (Google added later)?
3. **App name:** keep "Habiteer" as the working name, or your pick?

Everything else is decided. On `GO` I start Phase 1 and open `PROGRESS.md`.
