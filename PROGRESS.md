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

## v2 Phase 1 — Android home-screen widget (done)
Done
- Left Expo Go permanently for local testing — `react-native-android-widget`
  needs custom native code, which Expo Go can't run. One-time local Android
  toolchain set up this session (JDK 17, SDK command-line tools, platform
  35, NDK) and documented in `README.md` so it's reproducible, not tribal
  knowledge. `npx expo run:android` (dev client on the USB-connected device)
  replaces Expo Go for all testing going forward.
- `src/features/widget/`: `snapshot.ts` (pure, tested — `buildWidgetSnapshot`
  reuses `filterDueToday`/`trackableStatus` rather than re-deriving due-today
  or streak logic; `capSnapshotRows`/`rowsForHeight` handle resize-adaptive
  row counts without needing live app data in the background), `storage.ts`
  (AsyncStorage), `HabitWidget.tsx` (the widget UI, built from the library's
  RemoteViews-backed primitives — not regular React Native views),
  `taskHandler.tsx` (background handler for add/update/resize/click),
  `useWidgetSync.tsx` (pushes a fresh snapshot whenever the same live
  TanStack Query data every screen already uses changes).
- Tap-to-complete on the widget calls the same `fn_complete_trackable` RPC
  used everywhere else (`completeTrackable` from `src/features/completions/
  api.ts`, reused not reimplemented). **Best-effort sync, confirmed with
  user**: optimistic local update always shows immediately; a failed sync
  leaves that state until the real app next reconciles — not a hardened
  retry queue, a deliberate scope choice for this first cut.
- Custom entry point (`index.js`, `package.json` `"main"`) registers the
  widget task handler before requiring `expo-router/entry` — must use
  `require()` there, not `import`, since ES import hoisting would otherwise
  run Expo Router's entry before the handler registration.
- 8 new tests (49 total, all green); `tsc --noEmit` clean.
- Verified live on device: widget added to home screen, shows real due-today
  items/coin balance/top streak, tap-to-complete confirmed working, resize
  confirmed adapting row count.
- User-reported bugs fixed in passing: password field had no visible text
  color (fell back to a low-contrast platform default) and no show/hide
  toggle — added both (`app/(auth)/sign-in.tsx`).

Known follow-ups (not blocking)
- No retry queue for failed widget-tap syncs (accepted scope decision above).
- Widget preview image is a placeholder solid-color PNG, not real branding —
  tracked as part of the UX/UI polish pass now underway (see below).

## v2 Phase 2 — Shared rewards + groups + invite codes (done)
Done
- Schema: `groups` (id, name, `invite_code` unique, `created_by`,
  `created_at`), `group_members` (group_id, user_id, joined_at, unique
  pair), `reward_contributions` (id, reward_id, user_id, amount,
  created_at) — Drizzle migration, `rewards.group_id` given a real FK
  (previously a bare uuid column since Phase 1).
- RLS (`rls.sql`): `groups` — members-only `SELECT` (plus `created_by =
  auth.uid()` — see gotcha below), `INSERT` gated at level 3 via a new
  `caller_level()` helper. `group_members` — members-only `SELECT`, **no**
  `INSERT` policy for `authenticated` at all (the only path in is
  `fn_join_group`). `rewards`' Phase 1 policy extended to also cover shared
  rewards for group members. `reward_contributions` — members-only
  `SELECT`, own-contribution `INSERT`.
- RPCs (`rpc.sql`): `fn_join_group` (`SECURITY DEFINER` — the first in this
  codebase; a non-member can't `SELECT` a group by code otherwise),
  `fn_contribute_to_reward` (`SECURITY INVOKER`, mirrors
  `fn_redeem_reward`'s shape). `fn_redeem_reward` now explicitly rejects
  non-personal rewards — see gotcha below. Full detail in `rpc.README.md`.
- Client: `src/features/groups/` (schemas/api/hooks/`GroupCard`/
  `CreateOrJoinPanel`, mirrors `features/rewards/`'s layered pattern),
  `features/rewards/` extended with `SharedRewardCard` + shared-reward
  api/hooks. New 4th tab `app/(tabs)/groups.tsx` + stack screen
  `app/group/[id].tsx` (invite code, member list, shared rewards with a
  funded-progress bar and a "chip in" contribute control).
- 6 new RPC integration tests (`fn_join_group`, `fn_contribute_to_reward`);
  56 total, all green; `tsc --noEmit` clean. Verified live on device: the
  level-3 gate correctly blocks group creation for a level-1 account with
  the right message, joining with an invalid invite code surfaces a clean
  "invalid invite code" alert end-to-end (RPC → RLS → client).

Two real Postgres/RLS gotchas hit and fixed while implementing this:
- **Self-referencing RLS policy → infinite recursion.** The obvious
  `group_members` `SELECT` policy (`group_id in (select group_id from
  group_members where user_id = auth.uid())`) subqueries its own table from
  inside its own policy — Postgres re-evaluates the policy for that
  subquery and recurses forever. Fixed with a `SECURITY DEFINER` helper,
  `my_group_ids()`, that looks up membership without re-triggering the
  policy (same "bypass RLS for one narrow, necessary lookup" justification
  as `fn_join_group`).
- **`INSERT ... RETURNING` under RLS also enforces the `SELECT` policy.**
  `supabase-js`'s `.insert().select()` sends `INSERT ... RETURNING`, and
  Postgres requires the returned row to satisfy the table's `SELECT`
  policy too, evaluated in the *same statement* — too early to see an
  `AFTER INSERT` trigger's own effects. A group's creator couldn't see the
  group they'd just created, even with a trigger that adds them to
  `group_members`, because that trigger's insert lands one statement too
  late. Fixed by adding `or created_by = auth.uid()` directly to the
  `groups` `SELECT` policy — the trigger still runs and is still needed for
  every *other* group-scoped policy (rewards, contributions, re-fetching
  later), just not for this one immediate-visibility case.

Also found and fixed, unrelated to groups but surfaced while confirming a
clean TDD "red" baseline before this phase's work:
- **Real regression, not a test bug**: `drizzle-kit push` (v0.31 added
  RLS-awareness) silently emitted `DISABLE ROW LEVEL SECURITY` for every
  pre-existing table on the schema push for this phase's new tables, since
  `schema.ts` never declares `.enableRLS()` on them. This briefly made
  every table's data readable/writable by any authenticated user,
  regardless of ownership — caught because it broke the
  "hides another user's trackable" RLS test. Fixed by re-running
  `db:apply-sql` (`rls.sql` is idempotent) — but the underlying gap
  (`schema.ts` and the live RLS state can silently diverge on any future
  `db:push`) is not fixed, flagged as a follow-up below.
- A stale ~20 XP of drift on the persistent integration-test account,
  caused by that same RLS gap: while RLS was down, a cross-user test
  ("hides another user's trackable") actually completed another user's
  trackable *as* the test account, leaving two orphan `completions`/
  `coin_ledger` rows that its cleanup never anticipated. Purged manually;
  broke two freeze-token boundary-crossing tests until found.

Known follow-ups (not blocking)
- **`db:push` can silently disable RLS on tables `schema.ts` doesn't mark
  `.enableRLS()` on** (found above) — no code fix applied yet. Either add
  `.enableRLS()` to every table in `schema.ts`, or always re-run
  `db:apply-sql` after any `db:push` and treat that as a hard rule, not a
  "should be fine" assumption.
- No "leave group" affordance (out of scope for this pass, per the plan).
- Contributions are not undoable (matches the existing accepted gap for
  personal reward redemption).
- No image support for shared rewards (emoji-only, same as personal
  rewards).

## v2 Phase 3 — Week/month quota recurrence (done)
Done
- `trackables.period`/`.quota` existed since Phase 1 but were completely
  unused (`quota` hardcoded to `1`, `period` hardcoded to `'day'`/`null`,
  never read by `streak.ts`, `fn_complete_trackable`, `filterDueToday`, or
  `trackableStatus`) — greenfield behind an already-reserved schema shape,
  matching PLAN.md §7's "3×/week → period week, quota 3 (v2). Monthly →
  period month, quota 1 (v2)... v1 ships day + weekdays; the week/month code
  paths are stubbed behind the same model."
- **Streak semantics, made concrete**: a period counts toward the streak
  exactly once its completions-so-far reach quota — including the current,
  still-open period. For `period='day'` (quota always 1) this reduces to
  exactly the pre-existing daily behavior, bit-for-bit unchanged. Extra
  completions beyond quota in the same period still pay XP/coins but don't
  extend the streak further or push the progress display past quota/quota.
  Implemented identically twice, same pattern as every prior gamification
  feature: `src/features/gamification/streak.ts` (pure, tested first) and
  `fn_complete_trackable`'s new period-walk branch in `rpc.sql` (existing
  day-walk left completely untouched for `period='day'`). New pure
  `periodProgress()` in `streak.ts` for the "2/3 this week" display, which
  the RPC doesn't return (computed client-side from completions the app
  already has).
- **Level 5 gate** (confirmed with user, per PLAN.md §9's "Lv 5 ... advanced
  recurrence"): creating or editing a habit *into* `period` week/month
  requires level 5, enforced via `rls.sql`'s `"own trackables"` `WITH CHECK`
  — same `caller_level()` helper added in Phase 2 for the group-creation
  gate. Client mirrors it in `TrackablePanel` for a friendly message only.
- Client: `dates.ts` (`weekStart`/`monthStart`/`prevPeriodStart`), `today.ts`
  (week/month habits always due, no weekday gating), `TrackablePanel`'s
  Schedule selector extended to 4 options (Every day / Specific days /
  Weekly / Monthly) with a quota input and the level-5 hint,
  `TrackableCard`/`derived.ts` show a "N/quota this wk/mo" progress badge
  alongside the (now period-aware) streak flame.
- 18 new tests (8 `streak.ts` + 7 `rpc.test.ts` integration + 2 `today.ts` +
  1 `derived.ts`; 74 total, all green, run twice back-to-back); `tsc
  --noEmit` clean. Verified live on device: seeded temporary XP on the
  user's real account (with explicit confirmation) to reach level 5,
  created a Weekly ×3 and a Monthly ×2 habit, confirmed the progress badge
  updates on completion (0/3 → 1/3), confirmed the level-5 gate correctly
  blocks/unblocks based on level; both temporary artifacts (seeded XP, test
  habits) removed afterward per the user's choice.

Bugs found + fixed this session (test-only, never shipped):
- The period-walk's initial test cases failed because seeded historical
  completions predated the freshly-created test trackable's own
  `created_at` — the walk's existing "don't bridge a period that was never
  real" guard (correctly) stopped immediately. Not a product bug: fixed by
  backdating `created_at` in the test fixtures via the existing `createdAt`
  override, matching how day-based streak tests already handle this.

Known follow-ups (not blocking)
- No UI affordance to see *which* days/weeks satisfied quota historically
  (e.g. a calendar view) — only the current period's live progress and the
  running streak count are shown.

## v2 UX/UI redesign — Phase A: app icon, fonts, splash (done)
The design brief from the earlier "Now: UX/UI polish pass" came back as a
full redesign deliverable (`Habiteer Design - shareable.html`) covering the
app icon, every existing screen restyled, and three new
screens/systems (Profile, a shared modal shell, redeem/level-up
celebrations). It's large enough to span several phases (A–E); this session
shipped Phase A. See the plan file referenced in PROGRESS for the full
phase breakdown and the gaps/inconsistencies found while reviewing the
deliverable (Groups/shared-rewards screens and week/month habit cards have
zero design coverage since the design predates both; "longest streak" for
the upcoming Profile screen needs new forward-scanning logic, not a wire-up).

Done
- **App icon — direction 1d, "Level-up H"** (user's explicit pick over the
  designer's recommended 1a checkmark badge): violet `#7B5CFF` background,
  ink monogram with the right stroke taller ("ascending"), a yellow
  `#FFD23F` cap on the taller stroke, rounded corners, sized down 5% per
  on-device feedback. Generated via a hand-written Node PNG encoder
  (`zlib.deflateSync` + CRC32, same approach as the widget-picker
  placeholder) with 4x supersample anti-aliasing and the standard
  rounded-box signed-distance function for the corners — verified alpha
  transparency on the foreground/monochrome layers by inspecting raw pixel
  bytes, not just the visual preview. Wired into `app.config.ts`
  (`icon`, `android.adaptiveIcon.{foregroundImage,backgroundImage,
  monochromeImage}`), replacing Expo's default placeholder that every build
  so far had shipped with.
- **Bundled fonts**: `@expo-google-fonts/space-grotesk` +
  `@expo-google-fonts/space-mono` (ship real `.ttf` files — the `.woff2`
  files fetched earlier for the design-brief artifact were web-only and
  wouldn't load via `expo-font` on Android). New `src/constants/fonts.ts`
  with named tokens (`display700`/`display600` for Grotesk,
  `mono700` for Space Mono), applied per the design's own spec — headings/
  wordmark, card titles/tab labels, and every number (XP, coins, streaks,
  ranks, invite codes) across every screen; body/error/empty-state copy
  stays on the system font as specified.
- **Splash**: adapted the design's checkmark-specific "stroke draws on"
  concept to the H direction actually shipped — the two bars rise into
  place (`scaleY`, staggered), then the yellow cap pops in with a spring,
  then fades to reveal the app (`src/components/AppSplash.tsx` — this
  session's first cross-feature shared component, same location Phase C's
  modal shell will use). Respects reduce-motion: falls back to a static
  render of the same icon, no animation, per the design's own note.
- `npx tsc --noEmit` clean; existing 74 tests unaffected (visual/config
  phase, no logic changes). Verified live on device: real icon on the
  home screen (rounded, correctly sized after feedback), fonts rendering
  correctly across Today/Rewards/Groups/Leaderboard, splash plays on cold
  start.

Known follow-ups (not blocking)
- Phases B–E (Today/panel restyle, 5-tab HUD + Profile + modal system,
  Rewards celebration + Leaderboard redesign, overlay polish + widget dark
  mode) not started — each gets its own confirmation before starting, per
  the approved plan.
- Reduce-motion fallback verified in code review, not device-tested against
  the actual Android "Remove animations" setting.

## Next
- Continue the v2 UX/UI redesign: Phase B (Today screen + add/edit panel).
- v2 roadmap per PLAN.md §13, once the redesign phases land: gamified stats
  page → league tiers → cosmetics/unlocks → reduction mode.
- Sounds/haptics implementation (spec'd in the UX brief, not yet built).

## Bugs / blockers
- None blocking. See "Known follow-ups" above for accepted v1/v2 gaps.
