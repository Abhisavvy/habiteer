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
- Reduce-motion fallback verified in code review, not device-tested against
  the actual Android "Remove animations" setting.

## v2 UX/UI redesign — Phase B: Today screen + add/edit panel (done)
Every value pulled from the design's live-rendered DOM (`outerHTML` of the
actual mockup, not screenshots) via the Browser pane's JS execution — the
technique adopted mid-Phase-A after the hand-eyeballed icon kept missing the
real spec. Continued for every screen in B, C, and D.

Done
- `TrackableCard.tsx` rebuilt to exact spec: hard 5,5 shadow, `opacity:0.62`
  done-state, light-tint emoji box, uppercase Mono difficulty pill, bare
  always-shown streak text (no badge), violet-bordered `×N` combo badge,
  coins-only payout, circular check button, repositioned DONE stamp.
  Shared `DIFF_TINT`/`DIFF_LIGHT_TINT`/`LIGHT_VIOLET` tokens extracted to
  `src/features/trackables/constants.ts` so `TrackablePanel` can't drift.
- `LevelBar.tsx` rebuilt: plain "LVL {n}" + "{into} / {need} XP" row over a
  pill-track fill.
- `app/(tabs)/index.tsx` header hierarchy redone (coins dominate, freeze
  token steps down to a plain outline chip), icon mark + wordmark added,
  dashed-border empty state for zero-habit accounts.
- `TrackablePanel.tsx` rebuilt: header + close button, segmented Habit/Task
  and Schedule controls, coin stepper (was free-text), live preview label.
- `npx tsc --noEmit` clean; existing tests unaffected (UI-only).

## v2 UX/UI redesign — Phase D (partial): Rewards celebration + Leaderboard (done)
Done
- `RewardCard.tsx` rebuilt: Edit/Delete as text links, conditional
  Redeem-vs-Locked styling by affordability.
- `RedeemSuccessOverlay.tsx` (new): jade celebratory card, auto-dismisses.
- `LevelUpOverlay.tsx` and `UndoToast.tsx` rebuilt to exact spec (S6):
  enlarged "LVL {n}", confetti decorations, freeze-token-gained badge,
  "Keep going" dismiss button (was a timer auto-dismiss); toast gets a
  jade check-badge and "Done · {name}" copy.
- `app/(tabs)/leaderboard.tsx` rebuilt: top-3 medal/shadow treatment with a
  violet "you" override, circular initial-letter avatars, low-population
  state ("You're rank #N of M" + `Share.share()` "Invite friends" — no new
  backend, the leaderboard is global not group-scoped).
- **Excluded from this pass, per the approved plan**: reward photos — needs
  a new Supabase Storage bucket + RLS + `expo-image-picker`, scoped as its
  own follow-up.
- `vitest.config.ts`: `testTimeout: 20000` — the full suite was flaking on
  Supabase network latency (5-9 different tests per run, always a timeout,
  never an assertion failure), not a logic regression; confirmed via an
  isolated clean run before touching config. Full suite green afterward.

## v2 UX/UI redesign — Phase C: 5-tab HUD + Profile + modal system (done)
Done
- **`src/components/Modal.tsx`** (new shared shell, second cross-feature
  component after `AppSplash`): scrim + bordered/shadowed card per the
  design's S10 spec, plus `ModalButton` with 5 color-coded variants
  (cancel/fire/jade/violet/ink) matching the design's "color-coded primary
  action" convention. Five concrete modals built on it, each replacing a
  bare `Alert.alert()`: `DeleteConfirmModal` (shared, used by both
  trackables and rewards), `RedeemConfirmModal` + `InsufficientFundsModal`
  (rewards), `SignOutConfirmModal` (auth), `StreakFreezeExplainerModal`
  (completions) — wired into Today (archive), Rewards (redeem/delete/locked
  tap), and the new Profile screen (sign-out, freeze-token row).
  **Deliberate copy deviation**: the mockup's streak-freeze copy says
  "earn one every 7-day streak," but the real rule
  (`FREEZE_TOKEN_LEVEL_INTERVAL`) awards tokens every 5 *levels*, not by
  streak length — used the real rule's wording instead of the mockup's
  literal (incorrect) text.
- **`src/components/BottomHUD.tsx`** (new custom tab bar, replacing expo-
  router's default `Tabs` styling): Today/Rewards/Board/Groups/Profile as
  5 equally-spaced columns at the mockup's exact 56px spec (icon SVGs and
  active/inactive colors extracted verbatim for the 4 tabs the design
  covers; Groups — postdating the design — gets a hand-drawn icon in the
  same stroke language). **Reconciled a real layout gap**: the mockup's
  HUD has only 4 tabs + 1 centered raised "+" flex child (5 slots); with 5
  real tabs needed, the "+" button is instead an absolutely-positioned
  overlay on top of the bar, so every tab keeps its exact mockup spacing
  untouched. The button is context-aware via a tiny new store
  (`src/features/navigation/addAction.ts`) — each screen registers its own
  "open add panel" callback on focus (`useFocusEffect`) and clears it on
  blur; Board/Profile never register one, so the button simply hides
  itself there. Today/Rewards/Groups' old inline dashed "+Add" buttons were
  removed in favor of this one physical button, per the plan.
- **`app/(tabs)/profile.tsx`** (new screen): avatar (initial-letter, tap ✎
  to rename — backed by a real `profiles.display_name` update, no new
  backend needed since the existing RLS policy already allows it), LVL
  chip + XP bar, 2×2 stats grid (Total XP, Longest streak, Habits done,
  Coins), tappable freeze-token row, Settings list (sound/haptics toggles
  persisted to AsyncStorage but not wired to real playback — same
  "spec now, build later" precedent as Reminders; dark mode row disabled
  with a "SOON" badge; Reminders is a static UI-only stub), sign-out
  (moved off the Today header entirely — replaced there with a small
  violet avatar button that opens Profile).
- **New gamification logic** (`longestStreakEver`, TDD): `currentStreak`
  only ever walks backward from today, so the Profile "Longest streak"
  stat needed a real forward-scanning, period-aware max — added alongside
  `nextDay`/`nextPeriodStart` in `dates.ts`. 9 new test cases (day +
  week/month period, grace, weekday-scheduled skip, past-run-longer-than-
  current) written and confirmed red before implementing; full suite green
  after (81 tests, up from 74).
- Computed over currently-active trackables only (archived habits' old
  configs — weekdays/period/quota — aren't fetched client-side, so their
  historical streaks aren't included in the "Longest streak" stat). Noted
  as an accepted scope limit, not a bug.
- `npx tsc --noEmit` clean; full `vitest run` green (81/81).

Known follow-ups (not blocking)
- Device verification still pending — phone was offline all of Phase
  B/C/D; deferred to reconnect, per the user's own call.

## v2 UX/UI redesign — Phase E: overlay polish + widget dark mode (done)
Done
- **`src/hooks/useReduceMotion.ts`** (new, extracted from `AppSplash.tsx`'s
  inline pattern now that a third component needs it): mirrors the OS
  reduce-motion setting.
- **`LevelUpOverlay.tsx`**: real entrance — the card scale+fades in
  (`spring` + `timing`, parallel) instead of popping in instantly; the
  confetti-star spin loop only starts when reduce-motion is off (previously
  ran unconditionally, an accessibility miss carried over from Phase D).
- **`UndoToast.tsx`**: real slide+fade entrance on mount, and an animated
  exit (both the 4s auto-timeout and a manual "UNDO" tap now animate out
  before calling `onDismiss`, instead of unmounting instantly) — reduce-
  motion skips both, same as the overlay.
- **Widget dark mode**: `HabitWidget.tsx` takes a `dark?: boolean` prop;
  `taskHandler.tsx` and `useWidgetSync.tsx` now call `renderWidget`/
  `props.renderWidget` with `{light, dark}` (the library's own supported
  `WidgetRepresentation` shape — Android's RemoteViews renderer swaps
  between them per the system day/night setting, no app-side detection
  needed). Palette (`src/features/widget/darkTheme.ts`) is extracted
  verbatim from the design's S8 "Dark mode — a peek" mockup DOM — page bg
  `#151021`, card `#221B33`, track `#241D33`, borders/text invert to paper
  `#F3F0FF` (the mockup's own stated rationale: "ink borders invert to
  paper on a deep-violet surface"), accent violet lightens to `#A78BFF` for
  contrast; semantic colors (yellow/jade/fire) confirmed unchanged in the
  same mockup. One value has no mockup example to lift (`doneCard`, since
  S8 only shows undone rows) — an interpolated violet-tinted dark, flagged
  in the file as analogous rather than extracted, same as the widget's own
  pre-existing "approximates the app's look, not a 1:1 port" precedent.
- **Widget-picker preview image** (`assets/widget-preview.png`) regenerated
  from a flat violet square to a structural mockup of the widget's real
  layout (title bar, coin badge, an undone row + a done row with its jade
  check accent, streak pill) — same hand-written PNG encoder as the app
  icon (rounded-box SDF + 4x supersample AA), now generalized to a
  painter's-algorithm shape list instead of the icon's H-specific one.
  **Limitation, not silently glossed over**: there's no font/glyph
  rasterizer available in this environment, so "Habiteer" and habit names
  are represented as solid bars (a wireframe/"greeked text" convention),
  not literal legible copy — every other element (coin-badge yellow, card
  colors, done-row tint, jade/fire accents) is the real token color.
- `npx tsc --noEmit` clean; full `vitest run` green (81/81, unchanged —
  this phase touched no gamification logic).

Known follow-ups (not blocking)
- Device verification pending for all of B/C/D/E together — the phone has
  been offline this entire redesign; deferred to reconnect.
- The widget-preview image's text-as-bars limitation above could be
  replaced with a literal on-device screenshot once the phone reconnects,
  if a truer preview is wanted later.

## v2 UX/UI redesign — Groups/shared-rewards restyle (follow-up, done)
The one gap Phase A–E left flagged as "still open": Groups predates the
design deliverable entirely, so `groups.tsx`, `group/[id].tsx`,
`GroupCard`, `CreateOrJoinPanel`, and `SharedRewardCard` never got a
restyle pass (Phase C only gave Groups a bottom-HUD tab + icon). Done
while waiting on the phone to reconnect, since it doesn't need a device
and closes out the redesign completely.

Done
- Applied the now-fully-locked tokens by extrapolation, not extraction —
  no mockup exists for these screens, so this reuses established patterns
  instead: hard offset shadows (5,5 cards / 3–4,3–4 buttons) everywhere
  that was missing them, exact font families throughout (several spots
  had none at all — plain system font), the segmented-control pattern from
  `TrackablePanel` for `CreateOrJoinPanel`'s Join/Create toggle, the
  Cancel/Save shadowed-button convention for its actions, the pill-track
  progress-bar convention (border3 ink, radius999) for `SharedRewardCard`'s
  contribution progress (was a thin height-12 bar with no border-right
  accent), and the dashed-box empty-state pattern from Today for Groups'
  zero-groups state (was plain text).
- **One judgment call**: `group/[id].tsx`'s own inline "+Add shared
  reward" button was restyled (solid violet, shadowed — no longer dashed)
  rather than removed in favor of the global floating "+" from Phase C.
  That button only reaches whichever *tab* is currently focused; this
  screen is a stack push outside the tab bar, so there's no way for it to
  trigger from there — it needs to keep its own button.
- `npx tsc --noEmit` clean; full `vitest run` green (81/81, unchanged —
  pure restyle, no logic touched).

## v2 UX/UI redesign — device verification (done, two real bugs found + fixed)
Phone reconnected; ran a full `expo prebuild` + `expo run:android` and
walked every screen touched since Phase A. Two genuine bugs surfaced —
both systemic, neither visible from code review or `tsc`/`vitest` alone,
since they're Android-rendering-specific:

1. **Hard shadows didn't render on Android at all.** `shadowColor`/
   `shadowOffset`/`shadowRadius` are iOS-only in React Native; Android
   only has `elevation` (a soft Material blur, not this app's crisp
   offset look), and even that wasn't showing. This affected **every**
   card, badge, and button in the app — the exact "screens don't match"
   complaint. Fixed with a new primitive, `src/components/HardShadow.tsx`:
   renders the shadow as an actual solid-color layer offset behind the
   content, instead of relying on native shadow props. It's a drop-in
   swap for `View`/`Pressable` — same style object, no call site needed
   its actual style values touched. Applied across all 17 files that had
   a `shadowColor` (~49 call sites): every component from B through the
   Groups restyle, plus `sign-in.tsx`.
   - Surfaced a second bug while building it: a semi-transparent box
     (`TrackableCard`'s done-state `opacity: 0.62`) let the shadow layer
     bleed through the *entire* overlap area (nearly the whole box), not
     just the true offset sliver, washing done-cards grey instead of a
     muted white. Root cause: RN/Android doesn't flatten a semi-
     transparent parent's children into one texture before fading unless
     `needsOffscreenAlphaCompositing` is set — without it, opacity
     multiplies down to each child independently. Fixed by moving
     opacity/transform to the wrapper with that flag set, so shadow+
     content always composite correctly before any fade is applied.
2. **The splash animation and sign-in screen never matched the current
   icon.** `AppSplash.tsx` was a hand-approximated H (solid ink bars, no
   badge frame) predating the icon's final paper-fill/ink-outline/badge
   treatment — it read as an old draft. Rewritten to the icon's exact
   SVG spec (same badge frame, same outline+fill layering, same cap
   placement), keeping the existing rise-then-pop animation. Separately,
   `sign-in.tsx` had **never been restyled at all** in this whole
   redesign — it wasn't assigned to any of Phases A–E — only its wordmark
   got a font token in Phase A. Rebuilt to the exact S1 mockup spec
   (extracted the same way as every other screen): badge-framed icon,
   "Level up your day." tagline, labeled inputs, Cancel/Create/Google
   button hierarchy.
- Verified live on device after both fixes: Today (cards, header badges,
  floating "+"), the sign-in screen, and the delete-confirm modal all
  render correct crisp shadows and the correct current icon.
- `npx tsc --noEmit` clean; full `vitest run` green (81/81 — pure
  rendering/UI fixes, no logic touched).

Known follow-ups (not blocking)
- Only Today, sign-in, and one modal were directly screenshotted on
  device; Rewards/Board/Groups/Profile/remaining modals weren't
  individually re-screenshotted after the shadow fix, but use the exact
  same `HardShadow` primitive already proven correct in three different
  contexts (plain cards, form buttons, modal), so this is low-risk.

## Next
- Commit everything together — device verification is now done and
  passing. Nothing committed yet; confirm with the user before running it,
  since this batches in every phase (A–E, Groups restyle, and this
  verification pass) as one commit.
- v2 roadmap per PLAN.md §13, once the redesign lands: gamified stats page
  (now largely covered by the new Profile screen — reassess what's actually
  left) → league tiers → cosmetics/unlocks → reduction mode.

Docs caught up this session: the plan file (`toasty-wibbling-treasure.md`)
now details B/C/D/E at the same level as A and marks the Groups gap
resolved, and `PLAN.md` §13 reflects v1/v2 items 1–8 as done, with the
redesign slotted in as an ad hoc addition after item 8.

## v2 UX/UI redesign — post-commit follow-ups (done)
Two direct asks after the Phases B–E + Groups restyle commit:

1. **Profile off the bottom HUD.** Moved `app/(tabs)/profile.tsx` →
   `app/profile.tsx` — out of the tab group entirely, not just hidden
   from the tab bar's button list — matching the existing `group/[id].tsx`
   stack-push pattern. It's still reachable from the same violet avatar
   button on Today (`router.navigate("/profile")` — route path is
   unchanged since parenthesized groups don't appear in the URL), now
   with its own back arrow since it's no longer a tab peer. `BottomHUD.tsx`
   is back down to 4 tabs (Today/Rewards/Board/Groups) + the raised "+",
   which happens to restore the mockup's exact 5-slot structure (2 tabs,
   "+", 2 tabs) — Groups fills the slot the mockup's own Profile tab
   occupied, in place of Profile's now-unused extracted icon.
2. **Asset audit** — checked the design deliverable and everything else
   supplied for anything unused. The deliverable itself is 100% CSS/SVG,
   no embedded raster images at all (confirmed via a literal search for
   `<img>`/`data:image` in the HTML) — nothing missed there. Two other
   Habiteer-named files turned up in Downloads but are both historical,
   already superseded: `Habiteer.zip` is a backup of the Phase 1 scaffold
   from before this session; `habiteer.jsx` is the very first web
   prototype (2-tab, no rewards/groups/freeze) that `theme.ts`'s "ported
   from the validated prototype" comment already refers to — both
   pre-date and are fully subsumed by the current app.
   - Did find one real gap while auditing, unrelated to the design
     deliverable itself: **no native splash-screen image was ever
     configured**. `app/_layout.tsx`'s custom animated `AppSplash` only
     takes over once the JS bundle evaluates — before that, Android was
     showing Expo's generic default splash, not the app's branding. Wired
     `expo-splash-screen`'s config plugin to the existing `assets/icon.png`
     on a violet background, so the native pre-JS moment now matches too.
- `npx tsc --noEmit` clean; full `vitest run` green (81/81). Native
  rebuild required (splash plugin is native config) — `expo prebuild` +
  `expo run:android` done, verified on device: bottom HUD now shows 4
  tabs, avatar → Profile opens correctly with a working back arrow.

**Still open, would need a genuinely new design pass, not a restyle, if
wanted:**
- **Reward images** (optional photo per reward) — needs a new Supabase
  Storage bucket + RLS storage policies + `expo-image-picker`, a real
  backend capability, not a visual change. Explicitly excluded from
  Phase D per the original plan.
- **Full app dark mode** — the design deliverable itself frames this as
  "exploratory, not required this pass" (only the widget got a dark
  variant, which is done). Extending it to the whole app would mean a
  second full token set + per-screen verification, on the scale of
  redesign Phases B–E again.

## v2 UX/UI redesign — post-commit bug batch (all fixed)
Three bugs reported together after the Profile-move commit, plus a separate
widget-styling ask:

1. **Habit completion doesn't visually update the card — FIXED, root
   cause confirmed.** Static review found nothing; the bug only
   reproduces in a specific time window, which is why it looked
   intermittent. Root cause: `today()` in `src/features/trackables/
   today.ts` computed the **local device date** (`new Date().getFullYear()/
   getMonth()/getDate()`), but the server's `current_app_date()`
   (`rpc.sql`) is deliberately **UTC-anchored**, matching the rest of the
   gamification lib (`dates.ts` uses `getUTCDate()` everywhere — the
   comment right above `current_app_date()` even names this convention).
   On a device in IST (UTC+5:30), between local midnight and ~5:30 AM,
   the client's "today" is a full calendar day ahead of the server's — so
   a habit completed that UTC-day never matches the client's done-check,
   no matter how many times you tap. Confirmed via a live device repro
   with temporary `console.log` instrumentation (removed after
   diagnosis): the mutation *was* succeeding every time — the RPC's own
   same-day idempotency guard correctly no-op'd repeat taps (no double
   coin-granting, confirmed via a direct query against the live coin
   ledger) — but the client-side `isDoneToday` check never flipped
   because of the date mismatch. Fixed by making `today()` UTC-anchored
   (`new Date().toISOString().slice(0, 10)`), built TDD (a new test
   pins the local-vs-UTC drift at a fake IST midnight-crossing instant,
   confirmed red, then green). Verified end-to-end on device: after the
   fix, an already-completed habit from hours earlier immediately showed
   its DONE stamp/strikethrough/jade check and the header's done-count
   updated, with no further tap needed (Fast Refresh + the now-correct
   date matching the already-cached completion).
2. **`TrackablePanel`'s Name input placeholder was invisible** (white-on-
   white). Root cause: the VALUE text color was always correct
   (`theme.color.ink`) — it was the *placeholder* falling back to a
   system default with no `placeholderTextColor` set. Fixed here and, on
   audit, also missing in `CreateOrJoinPanel.tsx` and `RewardPanel.tsx`.
3. **Schedule segmented control ("Every day"/"Specific days"/"Weekly"/
   "Monthly") wasn't vertically centered** — "Specific days" (the longest
   label) likely wraps to 2 lines in its ~1/4-width slot, and `segment`
   only had horizontal centering (`alignItems`), not vertical
   (`justifyContent`). Added `justifyContent: "center"` +
   `textAlign: "center"`, applied to both `TrackablePanel.tsx` and (for
   consistency) `CreateOrJoinPanel.tsx`. Not yet re-verified on device.
4. **Removed the add/edit panel's "↓ Live preview"** section per request
   — deleted the preview `TrackableCard` render, its now-unused
   `previewTrackable`/`previewStatus` locals, and the now-dead imports.
5. **Found while investigating #2, not directly reported: `RewardPanel.tsx`
   had never been restyled in this whole redesign** — zero font tokens,
   zero shadows, a plain numeric cost input. Rewritten to match
   `TrackablePanel`'s locked conventions exactly: header row + close
   button, `HardShadow` panel, `HardShadow`-wrapped emoji swatches with a
   yellow selected state, and the Cost field converted from free-text to
   a ±10 stepper (matching the Coins stepper pattern already used
   elsewhere) — `cost` state changed `string` → `number` (verified against
   `RewardFormValues`'s `z.ZodNumber` — no mismatch).
6. **"The widgets are not updated to the new style."** Investigated the
   `react-native-android-widget` library's real constraints first:
   `FlexWidget`'s style type (`CommonStyleProps`) has **no shadow/elevation
   prop at all** — box-level hard shadows are architecturally impossible
   here, unlike the rest of the app. No native font resources exist under
   `android/app/src/main/res/font/` either, so custom fonts aren't
   trivially usable in `TextWidget` without a real font-resource pipeline.
   Given those limits, the achievable win was difficulty-tinted, bordered
   emoji boxes per row (mirroring `TrackableCard`'s `DIFF_LIGHT_TINT`
   convention) and a bordered yellow coin badge in the header (mirroring
   the app's `coinBadge`). Built test-first: added
   `difficulty: Difficulty` to `WidgetSnapshotItem` in `snapshot.ts` (and
   `buildWidgetSnapshot`'s mapping), added a new `snapshot.test.ts` case,
   confirmed red (`expected undefined to be 'hard'`), then implemented to
   green (82/82). `HabitWidget.tsx` now renders each row's emoji inside a
   26×26 bordered box tinted by difficulty (light tint in the light
   variant; a new low-opacity `rgba` approximation — no dark-mode mockup
   example exists for this — in the dark variant), and the header coin
   balance inside a bordered yellow badge. One TS wrinkle: the library's
   `ColorProp` type is a strict `#hex` / `rgba(n, n, n, n)` template
   literal (spaces after commas required) — `DIFF_LIGHT_TINT`'s type is
   plain `string` (used elsewhere as a normal RN style value), so it needs
   an explicit cast at the widget call site; not worth widening the
   shared constant's type just for this one strict consumer.
- `npx tsc --noEmit` clean; full `vitest run` green (83/83 — the widget-
  difficulty test plus the new `today()` UTC-anchoring test).
- **Item 1 (completion not updating) is device-verified end-to-end** —
  reproduced live via a real device repro session, root-caused to a
  local-vs-UTC date mismatch, fixed, and confirmed working on-device: an
  hours-old completion instantly showed as done post-fix, and the coin
  balance (separately double-checked against a direct query against the
  live database) settled to the correct true total. **Item 6 (widget)
  still needs the user to check the actual home-screen widget** — can't
  screenshot it directly (it's outside the app's own screen, and `adb
  shell input` is blocked on this device by `INJECT_EVENTS`, so I can't
  add/resize it myself either). Items 2/3/4/5 are code-level fixes
  verified by `tsc`+`vitest` only, not yet re-screenshotted on device.
- **Superseded shortly after by a full mockup-driven rebuild** — see next
  section.
- **Not committed yet** — no commit/push request for this batch.

## Widget rebuild to match a supplied reference mockup (done, device-verified)
After the above, the user supplied a concrete light/dark mockup image
(checklist-in-a-card style, with a clock, superseding the difficulty-tint
iteration above) and then iterated live against the real device across
several rounds — two of which surfaced genuine crashes, not just visual
misses. Final shipped state, after all rounds:

- `snapshot.ts`: swapped the now-unused `difficulty` field on
  `WidgetSnapshotItem` for `payout: number` (the per-item coin value the
  mockup shows as "+18"/"+10"/etc.), computed via the same task-difficulty-
  discount rule `TrackableCard` already uses. Also replaced
  `rowsForHeight`'s guessed size-buckets with an explicit
  `FIXED_CHROME_DP` + `ROW_HEIGHT_DP` formula (`Math.floor((heightDp -
  60) / 32)`, clamped 1–6) — the guessed buckets were tuned for the old
  compact layout and silently stopped matching once the new layout's
  fixed chrome grew, which is exactly what caused rows to get clipped off
  the bottom (see crash #2 below). TDD'd throughout: `payout` test and
  the updated `rowsForHeight` bucket assertions confirmed red, then green
  (83/83 total).
- `HabitWidget.tsx` final layout: one bordered card (ink border in light,
  paper-white border in dark — the app's standard convention, not a
  deviation) containing a header row (violet "H" badge + "Habiteer" +
  inline clock + `🪙 {balance}`), a divider, checkbox rows (jade-filled +
  white check when done, outline otherwise, per-item `+{payout}`, thin
  dividers between), and a footer row (`+N more due today` / `🔥
  {streak}`).
- **Two real crashes found and fixed via live device repro** (logcat
  watched through several force-close/reopen cycles), not just visual
  misses:
  1. `OverlapWidget` (used for a mockup-accurate "peeking clock card
     behind the main card" effect, via Android's native `FrameLayout`)
     had no explicit `width` — its `wrap_content` default deadlocked
     against its `match_parent` children, collapsing it to zero size and
     throwing `IllegalArgumentException: width and height must be > 0`
     in `RNWidget.drawViewToBitmap` on every render attempt, so the
     widget just kept showing whatever it had rendered before the crash
     started (looked like "not updating" from the outside). Root-caused
     via `adb logcat` at the exact moment of a triggered re-render.
  2. Even after that fix, the peeking-clock structure's *total* fixed
     height exceeded the widget's actual configured size on the user's
     home screen (sized for the old compact layout), silently clipping
     habit rows off the bottom — no crash, just missing content. Fixed
     by dropping the separate clock card entirely (folded the clock into
     the header row — one whole element's height cheaper) and replacing
     `rowsForHeight`'s guesswork with the explicit formula above.
  3. A third attempt to show the *real* app icon via `ImageWidget` (the
     user asked for the actual logo, not a generic checkmark) crashed
     intermittently with the same `width and height must be > 0`
     exception — the native `ImageView` apparently measures 0×0 before
     its bitmap finishes loading, and `drawViewToBitmap` doesn't wait for
     it. A background retry sometimes succeeded silently, making it look
     merely "stale" rather than crashing — but real device logs showed
     the exception firing on most attempts. **First fix attempt was a
     hand-drawn violet + "H" approximation** instead of the real icon —
     the user correctly pushed back that this didn't meet the actual
     requirement, which prompted properly reading the library's native
     Java source (`RNWidget.java`, `ImageWidget.java`, `ResourceUtils.java`
     — all vendored under `node_modules/.../android/src/main/java/`)
     rather than assuming the crash was an unfixable async quirk.
     **Real fix**: `ImageWidget`'s `require()` path resolves to an
     `http://`-scheme URL and fetches it from Metro's dev server over the
     network on every single render — `ResourceUtils.getBitmap` does this
     fetch synchronously on a background worker thread, and a
     transiently-failed fetch is exactly what was collapsing the bitmap
     size. But that same function ALSO resolves a **plain scheme-less
     string** to a compiled Android drawable resource via
     `BitmapFactory.decodeResource` — a fast local decode, no network at
     all. Added a `withWidgetIconResource` config plugin to
     `app.config.ts` (via `expo/config-plugins`' `withDangerousMod`) that
     copies `assets/icon.png` into `android/app/src/main/res/drawable/
     widget_icon.png` on every `prebuild` (`android/` is gitignored and
     regenerated, so a one-off manual copy wouldn't survive), then
     `HabitWidget.tsx` references it by that resource name (cast around
     `ImageWidgetSource`'s type, which only declares `require()`/URL/data
     forms — the native code accepts more than the TS types admit).
     **This required an actual native rebuild** (`expo prebuild` +
     `expo run:android`), not just a JS/Fast-Refresh change, since a new
     compiled resource needs a real APK rebuild to exist at all.
  4. **After the icon fix, the user pushed back again**: "i was talking
     about the whole widget not just the icon" — the clock had been
     folded into a small inline header text after the first crash, which
     is a real, significant departure from the reference mockup's large
     peeking clock card, not a minor detail. Restored it properly this
     time, now that the `OverlapWidget` crash's actual cause (missing
     `width` on the OverlapWidget itself, not overlap being inherently
     unsafe) was understood — `CLOCK_CARD_HEIGHT_DP`/`CLOCK_PEEK_DP`
     constants control the peek exactly. This pushed total chrome height
     up again, clipping a row and the footer once more (first with
     `FIXED_CHROME_DP=100`, still short by roughly the header/footer rows
     I'd under-counted); widened it to `135` with a bigger safety margin
     after that, on the principle that under-filling by a few dp of
     empty space is far cheaper than clipping — confirmed on device with
     both habit rows, the streak footer, and the peeking clock all
     visible with no clipping.
- **Two real, stated platform limits** (not glossed over): this library's
  `TextWidgetStyle` has zero `textDecorationLine` support, so done items
  can only fade grey, not strike through, unlike the in-app card. And the
  clock is not live-ticking — it only reflects whatever moment the widget
  last actually re-rendered (app open, a habit tap, a resize, or the OS's
  own refresh, capped at `updatePeriodMillis: 1800000` — 30 minutes is
  Android's OS-level minimum, not a value this app chose).
- `npx tsc --noEmit` clean; full `vitest run` green (83/83).
- **Device-verified, final round** — logcat showed no crash; a screenshot
  of the actual home-screen widget confirmed the peeking clock card, the
  real app icon (matching the launcher icon directly, compared side by
  side in the same screenshot), the restored border, and both habit rows
  plus the streak footer all visible with no clipping. Dark variant
  screenshotted; light variant shares the same code path, not separately
  re-screenshotted.
- Unrelated hiccup hit mid-session and resolved: the `adb reverse
  tcp:8081` tunnel had dropped (device briefly disconnected), so the app
  couldn't reach Metro and failed to open — re-ran `adb reverse tcp:8081
  tcp:8081` and it opened normally. Not a code bug.
- **Not committed** — no commit/push request for this batch yet.

## Bugs / blockers
- None blocking. See "Known follow-ups" above for accepted v1/v2 gaps.
