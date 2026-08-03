# PROGRESS

## Phase S — Economy integrity (three live vulnerabilities, found and closed)

Found while adversarially reviewing the design for the staked-pledge rework
of long-horizon goals (the user's feedback was that goals "don't connect to
the player", and the chosen fix was to put real coins at stake). Staking
coins on a currency anyone can mint is meaningless, so this had to come
first — and it turned out to matter far more than the feature that surfaced
it.

**All three were proven live before fixing, not theorised.** As an ordinary
signed-in user against the real database:

| Attack | Result before fix |
|---|---|
| `POST /coin_ledger {delta: 999999}` | **minted** — balance 30 → 1,000,029 |
| `POST /completions {xp_earned: 999999}` | **accepted** |
| `PATCH /freeze_tokens {balance: 99}` | **written** |
| `POST /quest_claims` (self-grant a reward) | **accepted** |
| `POST /league_standings {tier:'diamond'}` | **accepted** |

### Root cause
`rls.sql` had `create policy "own X" on X for all using (user_id =
auth.uid())` with **no `WITH CHECK`** on `completions`, `coin_ledger` and
`freeze_tokens`. Postgres uses the `USING` expression as the insert/update
check when `WITH CHECK` is omitted on a `FOR ALL` policy — so any row was
insertable as long as `user_id` was the caller's own. `quest_claims` and
`league_standings` had explicit `with check (user_id = auth.uid())`, which
is the same hole stated out loud.

Because coin balance is always `sum(delta)` and `caller_level()` is always
`sum(xp_earned) from completions`, this meant the entire economy, XP,
levels, streaks, leaderboard, league tier **and every capability gate**
(groups at L3, week/month recurrence at L5, all cosmetics) were
client-forgeable. `fn_redeem_reward`'s insufficient-funds guard was
decorative.

### The fix, in the order it had to happen
1. **`fn_complete_trackable`, `fn_undo_completion`, `fn_redeem_reward`,
   `fn_contribute_to_reward` are now `security definer`.** They had to go
   first: they write `completions`/`coin_ledger` **as the caller**, so
   closing the tables before this would have broken completion outright.
2. **Every read they do is now explicitly ownership-checked.** `security
   definer` means RLS no longer filters for them, so the four
   `-- RLS-filtered` reads became privilege-escalation vectors — without
   an explicit `and user_id = auth.uid()`, a caller could pass someone
   else's id and complete/undo/redeem *their* rows. Those comments were
   removed as now-false.
   - In `fn_redeem_reward` the ownership check is deliberately ordered
     *after* the `kind != 'personal'` guard and reuses the message
     `'reward not found'`, so existing error semantics are preserved and
     the function never leaks whether another user's reward id exists.
   - In `fn_contribute_to_reward` the group-membership check was a
     "friendlier duplicate of an RLS rejection"; it is now the sole
     authorisation gate and is commented as load-bearing.
3. **Then the tables were closed** to `for select` only — no
   INSERT/UPDATE/DELETE policy exists for them at all, so those commands
   are denied. Applies to `completions`, `coin_ledger`, `freeze_tokens`,
   `quest_claims`, `league_standings`.
4. **`for update` row lock added** to every coin-moving RPC
   (`perform 1 from profiles where id = auth.uid() for update`). There was
   no lock anywhere in `rpc.sql`, which left a live balance TOCTOU in
   `fn_redeem_reward`: two concurrent redeems at balance 50 costing 50
   each could both pass the check and drive the balance to −50.

### Test-infrastructure consequence, handled deliberately
Closing these tables broke every seed helper (`setFreezeBalance`,
`seedHistoricalCompletion`, `seedXp`, `seedLeagueStanding`,
`makeCompetitor`, and the cleanup helpers) — they all wrote through
`testClient`. They now go through a **direct Postgres admin connection**
using the `DATABASE_URL` already in `.env` (no new secret; `pg` was already
a dependency for `scripts/apply-sql.ts`).

The resulting split is worth keeping and is documented in `testClient.ts`:
**seed as admin, assert as the user.** A test may only ever *reach* state
via the privileged path; it must never use it to perform the behaviour
under test, or it would verify the privileged path instead of the one real
users take.

### A mistake worth recording
The first (red) run of the new rejection tests inserted successfully —
because the hole was still open — then failed its assertion and **left
999,999 coins in the shared test account.** A security test can leave
behind the very artifact it's proving impossible. Found it by noticing the
balance was 1,000,045 during re-verification, traced it to that run,
deleted it (balance back to 30), and hardened the test: it now `select()`s
the row it tries to insert and sweeps it in a `finally` via a new
`sweepLedgerRow` admin helper.

### Verification
- **Re-ran the original attack script**: all five vectors now return
  Postgres `42501` (insufficient_privilege). Balance unchanged.
- 6 new tests in a dedicated `economy integrity — client write paths must
  be closed` block, TDD'd red-first (4 of 5 failed before the fix; the
  5th, "still completes and undoes normally", passed throughout and was
  the guard against over-tightening).
  - One instructive correction: the `freeze_tokens` UPDATE case asserts by
    **effect** (balance unchanged), not by error — with no permissive
    UPDATE policy PostgREST reports success but matches zero rows. Only
    INSERT raises. Asserting the error there would have been asserting the
    wrong thing; a separate INSERT case covers the raising path.
- `npx tsc --noEmit` clean. Full suite **176/179** on a single clean run —
  the same 3 known live-DB-drift failures as the 170/173 baseline, plus the
  6 new tests, zero regressions.
  - Two intermediate runs showed 4–5 failures; that was **my own
    contamination** from running two full suites concurrently against one
    shared account (`freeze_tokens` is global per-user state reset in
    `beforeEach`, so concurrent suites fight over it). Confirmed by a
    single clean run rather than assumed away.
- **Not device-tested yet** — this is server-side, and the app's own paths
  are covered by the suite, but a device pass should confirm completing/
  undoing/redeeming still work through the UI before this is considered
  fully done.

## Phase R2 — Pre-commitment ritual

The second (and last) research wedge from point 1, and the small one. The
research finding behind it: most self-designed commitments carried **no**
financial stake, and goal-labeling/identity carries real weight on its own —
but ~39% abandon at the commitment step, so friction has to stay near zero.

- **Schema**: one nullable `why` text column on `trackables` (`db:push`'d,
  then **`db:apply-sql` re-run immediately** — push wipes RLS, the standing
  lesson from every schema change this session; verified after: RLS on for
  all tables, 14 policies present, column nullable as intended). Purely
  descriptive — gates nothing, needs no RLS change of its own, same
  precedent as `dueOn`/`reminderTime`.
- **Validation** (`schemas.ts`): added to `FORM_FIELDS` plus a
  `trim().max(80).nullable()` refinement. Capped at 80 chars deliberately —
  this is a one-line pre-commitment prompt, not a journal entry.
- **Client** (`api.ts`): `Trackable.why`, `mapRow`, and both the create
  insert and the update patch, following the existing per-field pattern
  exactly.
- **Input** (`TrackablePanel.tsx`): a "Why this matters (optional)" text
  field in the habit-only block, right after the Goal build/reduce control
  (thematically adjacent). Habit-only — a one-off task doesn't need an
  identity statement. Empty input normalizes to `null` on submit, so
  "never filled in" and "typed then cleared" are the same stored state
  rather than `""` vs `null` drift. A muted hint under the field tells the
  user where it'll come back, so the ask isn't unexplained friction.
- **The payoff surface — the actual design decision here.** The plan said
  "surfaced back on the card or on a behind-day" and left it open. Chose:
  render the quote on `TrackableCard` **only when `streak === 0` and it's
  not done yet today** — i.e. exactly when momentum is gone and the user is
  looking at a habit they've lapsed on. Deliberately NOT always-on: shown
  every single day it becomes wallpaper and stops landing, which would
  waste the one piece of intrinsic motivation the user gave us. This also
  needed no new signal — `status.streak` was already computed on every card.

### Verification
- `npx tsc --noEmit` clean. Six `Trackable` test fixtures needed the new
  field; five took an identical one-line addition, the sixth
  (`reminders/__tests__/schedule.test.ts`) has `reminderTime: "09:00"`
  rather than `null` so the batch edit skipped it — caught by `tsc`, not
  by assuming the sweep was complete.
- `npx vitest run`: **170/173** — same 3 pre-existing live-DB-drift
  failures, no regressions. No new test cases: this phase adds no new pure
  logic (one nullable column, one form field, one conditional render), so
  there was nothing to TDD — stated rather than padding the suite with a
  test that asserts a string passes through unchanged.
- **Device pass: done.** The phone dropped off USB mid-check first (same
  flakiness as earlier this session), came back, and the payoff surface was
  verified **both ways** — not just the happy path:
  - **Positive**: with a `why` set on the lapsed "Yy" habit (streak 0, not
    done today), the quote renders in italic violet on that card and on no
    other card (the other three have no `why`).
  - **Negative/suppression**: temporarily marked Yy done for today, and the
    quote correctly **disappeared** — both suppression conditions
    (`streak === 0`, `!isDoneToday`) firing as intended, with the card
    showing its normal DONE!/strikethrough/dimmed state.
  - **A third behavior confirmed for free**: the Phase R "👋 Welcome back"
    line also vanished in that same state, since `daysSinceLastActivity`
    became 0 — the negative case for that logic, which the Phase R pass
    only ever saw in its positive state.
  - `adb logcat` clean across the pass: no fatals, no JS exceptions.
- **All test data reverted**, verified by count rather than assumed: the
  temporary completion deleted (26 completions before and after, and it was
  inserted with 0 xp/0 coins so `coin_ledger` was never touched — 395 rows
  throughout), and the test `why` text cleared back to null on every
  trackable.
- **Both form paths confirmed working by the user** (2026-08-03), closing
  the last open gap on R and R2 together: R2's **"Why this matters" field**
  in the add-habit panel, and Phase R's **`GoalPanel`** (target stepper,
  2/4/6/8wk duration control, over-ambitious-target warning). This device
  blocks synthetic input (`SecurityException: INJECT_EVENTS`), so opening a
  form was never reachable from here — recorded as the user's own
  hands-on confirmation, distinct from the machine-verified checks above.
  **Phases R and R2 are now fully verified end to end.**

## Phase R — Long-horizon goal reframe

Resumes point 1 of the roadmap (research-backed wedges), parked while
point 2 (Motion M2–M4 → notifications → quest coherence, all shipped and
pushed) was in flight. Phase R is the #1 gap the deep-research pass
surfaced: no goal/milestone entity, no cumulative counting, no expected-
vs-actual pace, no lapsed-account detection. Two independent Explore/Plan
sub-agent passes grounded the design in the actual code before writing the
plan — one mapping exact UI/RLS conventions, one adversarially stress-
testing the architecture (see the approved plan for the full critique).

### Schema + DB
- **New `goals` table** (`id, user_id, trackable_id, target_count,
  starts_on, ends_on, created_at`) — not new columns on `trackables`,
  matching this project's own convention for a bounded concept layered on
  top (`freeze_tokens`, `quest_claims`, `league_standings` all took this
  shape; `trackables` already carries enough). `db:push`'d cleanly.
- **RLS**: plain own-row policy (`user_id = auth.uid()`) — no RPC. A goal
  doesn't move coins or XP, it's a read-only lens over completions that
  already happened, so it doesn't need `fn_claim_quest`-style
  security-definer treatment.
- **Real constraints, not just app-side checks**: `check (ends_on >=
  starts_on)`, `check (target_count > 0)`, and — the Plan-agent review's
  sharpest catch — a `btree_gist` EXCLUDE constraint
  (`exclude using gist (trackable_id with =, daterange(starts_on, ends_on,
  '[]') with &&)`) preventing two goals on the same trackable from having
  overlapping windows. An app-side "does today already have an active
  goal" check has a real gap: two future-dated goals that don't yet
  overlap "today" would sail past it, and a client check-then-insert is a
  TOCTOU race regardless. Verified behaviorally (not just "constraint
  exists"): a live insert-then-overlapping-insert in a rolled-back
  transaction confirmed the DB actually rejects it
  (`conflicting key value violates exclusion constraint`).

### Derived logic — TDD'd throughout, 22 new test cases
- **`goals/derived.ts`**: `goalStatus(goal, completions, today)` — `state`
  is `"met"` the instant progress reaches the target, even mid-window
  (same as a weekly quest); `"missed"` only once `today` is genuinely past
  `endsOn` (inclusive boundary — `today === endsOn` is still `"active"`,
  explicitly tested). `maxAchievableInWindow` — a rough ceiling on what a
  habit's own schedule could realistically produce in a window, used only
  for a soft warning, never for `goalStatus`'s own math.
- **`completions/derived.ts`**: `daysSinceLastActivity` — `null` for zero
  completions ever (a brand-new user is never "lapsed"), explicit guard
  rather than a number that would silently read as one.
- **`dates.ts`**: `daysBetween`/`addDays` — extracted the day-diff
  expression `app/quests.tsx`'s `daysLeft` already had inline (now needed
  in 2+ places), added a symmetric `addDays` for computing a goal's
  `endsOn` from a week-count preset.
- **A real cross-module bug found and fixed mid-implementation**:
  `expressionForStreak` (the broken-streak Ember mascot reaction, used by
  all 3 widgets but zero in-app screens before this phase) got moved so
  the in-app header could finally use it too — but moving it straight
  into `components/Ember.tsx` broke `emberSvg.test.ts`'s dependency-free
  isolation (that file is deliberately free of any `react-native-svg`
  import, used in a headless RemoteViews context and unit-tested with
  zero mocking; importing from `Ember.tsx` transitively pulled the native
  module in, and the test suite failed with a cryptic `SyntaxError:
  Unexpected token 'typeof'`). Fixed by giving the pure mapping its own
  dependency-free module, `components/emberExpression.ts`, imported by
  both `Ember.tsx` and `emberSvg.ts` independently — caught by actually
  running the affected test, not assumed safe from reading the diff.

### Client + UI
- **`goals/api.ts`/`useGoals.ts`**: direct RLS-gated `supabase.from("goals")`
  calls (no RPC, per the schema decision above) — `fetchGoals`/
  `createGoal`/`deleteGoal`, mirroring `quests/api.ts`'s exact shape.
- **`GoalPanel.tsx`** (new): built on the shared `Modal.tsx` shell (gets
  M3's real enter/exit animation for free) rather than a bespoke full
  panel like `TrackablePanel` — a target-count stepper + a 2/4/6/8-week
  duration segmented control, matching `TrackablePanel`'s exact preset-
  row/stepper-row convention. `startsOn` always defaults to today, not
  editable in v1. Shows a soft, non-blocking warning (via
  `maxAchievableInWindow`) if the target looks unreachable on the habit's
  own schedule — cheap, and protects against the exact demotivating
  failure mode this feature exists to fix.
- **`app/stats.tsx`**: per-habit row gained a goal line — "Set a goal"
  when none exists; a live pace readout ("🎯 6/10 · on pace" / "· behind
  pace") plus a "Remove" link while active; a final "Goal met!
  🎉"/"Goal ended" plus "Set a new goal" once it's over. The "set a new
  goal" path deletes the old goal first — a `"met"` goal's window often
  hasn't ENDED yet (met mid-window, same as a quest), so its row would
  still overlap a fresh goal starting today and the EXCLUDE constraint
  would reject it otherwise.
- **`TrackableCard.tsx`**: one more glance-only pill (gold, matching the
  existing period-progress badge style) showing live progress — but ONLY
  when the caller passes a goal in its `"active"` state; upcoming/met/
  missed stay Stats-only, not a persistent daily-card badge.
- **`app/(tabs)/index.tsx`**: the header `<Ember>` — previously always
  `expression="neutral"` by omission, reaching zero in-app screens despite
  `expressionForStreak` existing for widgets — now reflects
  `Math.max(0, ...dueStatuses.map(s => s.streak))`, the same "best current
  streak" signal the widgets already use (zero new logic needed, that
  value was already being computed there). Separately, and deliberately
  decoupled (per the Plan-agent review — streak length and dormancy don't
  mean the same thing; feeding one into the other would show "sleepy" for
  both a brand-new day-1 account and a 40-day-dormant one): a "👋 Welcome
  back" line appears under the level bar once `daysSinceLastActivity`
  crosses 3 days, independent of today's specific due list.

### Explicitly out of v1 (per the approved plan)
No bonus reward for meeting a goal (stays a read-only lens, not a new
payout surface). No multi-trackable/composite goals. No auto-renewal.
No editing an in-progress goal — delete + recreate. An archived
trackable's goal becomes an inert orphan (same as archived habits already
vanishing from Stats/Today) rather than being auto-closed.

### Verification
- `npx tsc --noEmit` clean throughout.
- `npx vitest run`: **170/173** (151 prior baseline + 22 new TDD'd cases
  across `dates.test.ts`, `completions/__tests__/derived.test.ts`,
  `goals/__tests__/derived.test.ts`), same 3 pre-existing live-DB-drift
  failures as every round this session, no regressions.
- RLS + constraints verified directly against the live DB: `relrowsecurity
  = true`, `own goals` policy present, both CHECK constraints and the
  EXCLUDE constraint present by name, and the EXCLUDE constraint's actual
  rejection behavior confirmed live (in a rolled-back transaction, no
  data persisted).
- **Device pass: done, and the most complete one of this session** — the
  phone reconnected right after the commit, so this got a real pass (the
  adb daemon had to restart, which needed the USB-debugging prompt
  re-approved on the device first). Fresh Metro with `--clear`, bundle
  confirmed new (3636 modules, up from 3631 — the new goals files).
  Verified live, all four goal states plus both lapsed-detection pieces:
  - **"👋 Welcome back"** renders correctly — this account's last
    completion was Jul 25 and the device clock reads Aug 3, so 9 days >
    the 3-day threshold. The exact case the old UI had no answer for.
  - **The header Ember is sleepy** (closed eyes) instead of the old
    always-neutral — every streak had reset to 0 after the 9-day gap, so
    `expressionForStreak(0)` → `"sleepy"`. First time this function has
    ever affected an in-app screen.
  - **No goal → "🎯 Set a goal"** on every per-habit Stats row.
  - **Active + behind pace → "🎯 4/20 · behind pace"** + Remove, with the
    gold `🎯 4/20` chip on that habit's Today card and on no other card.
    Numbers cross-checked against the DB directly: exactly 4 completions
    in the window, and day 15 of 28 expects ~10.7, so "behind" is right.
  - **Met mid-window → "🎯 Goal met! 4/3 🎉"** + "Set a new goal" — fires
    on progress reaching target, without waiting for the window to end.
  - **Missed → "🎯 Goal ended · 0/30"** + "Set a new goal"; 0 progress
    correct for that June–mid-July window (this habit's activity was all
    late July).
  - Today's chip correctly **disappears** for met/missed — it's an
    active-goal-only affordance, as designed.
  - `adb logcat` clean across the entire pass: zero fatals, zero
    AndroidRuntime entries, zero JS exceptions.
- **The RLS client path verified separately**, because it had to be: the
  goal states above were driven by direct `DATABASE_URL` writes, which
  bypass RLS entirely and therefore prove nothing about it. A short
  throwaway script signed in as the real test user via `supabase-js` (the
  same path the app uses) and confirmed insert / select / delete all work
  through the `own goals` policy, that the CHECK constraint rejects
  `target_count = 0` from the client too, and — the meaningful one — that
  the select returned **only that user's own goal**, not the other
  account's goal sitting in the same table. RLS isolation confirmed, not
  assumed.
- **`GoalPanel` was the one gap at the time of this pass** — input injection
  is blocked on this device (`SecurityException: INJECT_EVENTS`), so its
  render path, the target/duration controls, and the over-ambitious-target
  warning couldn't be reached from here. The write it performs was already
  covered by the RLS check above, but the panel's own UI wasn't.
  **Since closed:** the user confirmed the panel works hands-on
  (2026-08-03) — see the Phase R2 section's device-pass notes, where both
  form paths were confirmed together.
- All test goals deleted afterward; `select count(*) from goals` back to 0.
- **Committed** (`829ebf0`) and pushed. This closes out the roadmap's
  Phase R item (Phase R2, the small pre-commitment-ritual wedge, and
  point 3 — parked for hard launch — remain).

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

## Widget suite expansion — 4 widgets instead of 1 (done, device-verified)
User feedback on the single rebuilt widget above: "Still its not 100% exact
and you made just one widget and the requirement has multiple" — the P2
design deliverable's "07 Widget suite" section specifies four distinct
widgets (Today 4×2, Today 4×4, Companion 2×2, Streak 2×2), not one.

- Extracted shared chrome into `src/features/widget/palette.ts`
  (`FONT`/`SHADOW_DX`/`SHADOW_DY`/`CARD_RADIUS`/`widgetPalette()`) and
  `WidgetCardFrame.tsx` (the hard-shadow + halftone/solid-fill + border +
  padded-content scaffold every widget shares, with an optional
  `solidFill` prop for Streak's no-halftone card) so the four widgets
  can't drift apart on shadow/border/font tokens.
- New `TodayWidgetExpanded.tsx` (Today 4×4 — taller header with LVL +
  date, a level-progress bar built from two flex-ratio sibling
  `FlexWidget`s since this library's `SizeStyleProps` has no percentage-
  width support, per-row `+{payout}`), `CompanionWidget.tsx` (Companion
  2×2 — Ember's own SVG ported to a raw string in `emberSvg.ts` and
  rendered live via `SvgWidget`, safe here specifically because Ember's
  viewBox is square like the widget; `expressionForStreak()` swaps
  neutral/celebrate/sleepy at the same 7-day tier boundary
  `COMBO_TIERS` already uses — TDD'd, 3 cases), `StreakWidget.tsx`
  (Streak 2×2 — solid ember card per the mock spec, 🔥 + big streak
  number + "DAY STREAK" label).
- `snapshot.ts` extended with `level`/`intoLevel`/`need` (from the same
  `overallProgress()` every other screen already calls) and
  `rowsForHeightExpanded()` (separate chrome-height formula from the
  compact widget's `rowsForHeight()`, since the expanded header+bar is
  taller). `taskHandler.tsx` and `useWidgetSync.tsx` rewritten to push
  all four widgets by name (`WIDGET_NAMES`) instead of hardcoding one.
- `app.config.ts`'s widget plugin config extended from 1 to 4 entries;
  new structural preview PNGs generated for the widget picker
  (`scripts/gen-widget-previews.js`, same greeked-text convention as the
  original preview).
- `npx tsc --noEmit` clean; full `vitest run` green (145/148 — same 3
  pre-existing live-DB drift failures, unrelated).
- **Device verification found two real layout bugs**, both invisible to
  `tsc`/`vitest`/code review since they're purely about RemoteViews
  measuring actual on-screen space:
  1. **Streak widget**: the 🔥 emoji (40sp) + streak number (34sp) alone
     consumed the card's entire available content height, so "DAY
     STREAK" never rendered at all — not shrunk, just absent (Android's
     non-scrolling layout doesn't compress overflowing children, it just
     clips them outside the parent's fixed bounds). Fixed by shrinking to
     28sp/26sp/9sp and `contentPadding` 12→6; confirmed on-device that
     all three lines now render.
  2. **Companion widget**: same failure mode — the "🔥 N days" streak
     line was invisible (only a sliver of the flame glyph peeked through)
     because Ember's SVG (72dp) + "LVL N" (17sp) left no room. Fixed by
     shrinking to 60dp/15sp/10sp and `contentPadding` 10→6; confirmed all
     three elements render.
  - Today 4×4 needed no fix — its chrome-height formula already budgets
    real room. Today 4×2's title showed as "TODA…" on this home screen,
    but that's the launcher placing this specific instance narrower
    (~139dp) than its own declared 180dp minimum — a placement choice,
    not a rendering bug; widening the widget on the home screen resolves
    it.
  - Root-caused both bugs the same way: cropped/zoomed the actual
    home-screen screenshot pixel-by-pixel (via a throwaway Pillow venv,
    since no image tool was otherwise available) rather than guessing
    from source review — the card's full rounded border was visible with
    nothing missing past it, proving the text was never laid out at all,
    not merely scrolled off.
- Dark mode verified by toggling the OS theme directly (`adb shell cmd
  uimode night yes`, no touch input needed — worked around the earlier
  MIUI-blocks-synthetic-input limitation for this one system-level
  toggle) and reverted back to light afterward. All four widgets swap
  correctly (border ink→paper, card bg→dark violet, halftone dots
  render in white); Streak's solid ember fill is correctly unaffected by
  theme, per its own spec.
- **Follow-up bug, found by the user post-verification**: the Today
  widgets' header icon tile was rendering ember/orange in both light and
  dark, but the real app icon's background is violet (`theme.color.hero`
  = `#6B3EF0`, confirmed against the exact `HERO` value `gen-icon.js`
  itself renders the icon with) — a genuine brand mismatch, not a
  theme-dependent bug, since `palette.ts`'s `tile` field was hardcoded to
  `theme.color.ember` in *both* branches. Fixed by changing both to
  `theme.color.hero`. One snag while fixing: the first `Edit` call used
  `replace_all` but only changed the dark branch, because the two
  identical-looking lines actually differ in indentation (6 vs 4 spaces,
  nested vs top-level `return`) — `replace_all` matches the literal
  string including whitespace, so it silently missed the second one;
  caught by re-reading the file after the "successful" edit rather than
  trusting the tool result, then fixed with a second targeted edit.
  Confirmed via the compiled bundle that both branches now reference
  `theme.color.hero`, then confirmed visually on-device in both dark and
  genuine light mode (the device has a 7 PM–7 AM auto dark-theme
  schedule that kept overriding manual `adb shell cmd uimode night no`
  toggles, so light mode needed a quick re-check timed right after
  setting it). Streak/Companion widgets don't use this tile and were
  unaffected.
- **Not committed** — no commit/push request for this batch yet.

## Widget suite — matched to the CURRENT P2 mock + click-interaction fix (code+build done, device-verify pending)
The whole earlier widget suite had been built against a **stale extract**
(`/tmp/sec07.html`) of the P2 design. The user kept reporting a missing
"purple banner" and a missing "daily strip" widget; two blind guesses at
the banner (icon-tile → violet) were both wrong because they compared
against the *actual* current mock, not the in-app UI. The real current
mock was only recoverable from a zip the user attached
(`~/Downloads/App icon design review.zip` → `/tmp/icon_review/Habiteer P2
- Screens.dc.html`, the true 219KB deliverable). Its "07 WIDGET SUITE"
section is a **different, newer** design than the cached extract — lesson
recorded here so next time: check the user's attachment/zip for a fresh
design file before trusting any cached extract.

What the current mock actually specifies (now built to match):
- **6 widgets** (mock shows 5; Streak kept as a 6th, off-mock, because a
  live instance is already on the user's home screen and there's no way to
  programmatically remove an orphaned widget): Companion 2×2, **Combo 2×2
  (new)**, Today 4×2, **Quest 4×2 (new)**, Daily strip 4×4 (this replaces
  what the code still registers as `TodayWidgetExpanded` — the widget name
  is unchanged to avoid orphaning a placed instance; only its label
  changed to "Daily strip"), plus the off-mock Streak 2×2.
- **The "purple banner"**: Today 4×2's header is a full-bleed **ink**
  banner strip (gold-bordered Ember tile, gold "TODAY · N/M", white streak,
  gold coins); Daily strip 4×4's header is a full-bleed **violet**
  (`#6B3EF0`/dark `#8B63FF`) banner with the icon tile, "LVL N · NAME"
  (real display name from `fetchProfile`, plumbed through a new
  `WidgetSnapshot.displayName`), an *embedded* gold progress bar, and the
  streak/coins stacked right. Implemented via a new `header?` slot on
  `WidgetCardFrame` that renders full-bleed above the padded body using
  per-corner radius (`borderTopLeftRadius`/`borderTopRightRadius` — RN
  RemoteViews has no negative-margin/clip-path, but per-corner radius IS
  supported, confirmed in the vendored type defs) + a pre-baked white-dot
  banner texture (`scripts/gen-widget-halftone.js` → `widget-banner-dots.png`).
- **Night Patrol dark palette** (`darkTheme.ts` fully rewritten): the old
  file held a *different, older* redesign's dark values (S8) — replaced
  with the current mock's exact hex (ink `#0C0916`, card `#2E2447`, hero
  `#8B63FF`, gold `#FFD23F`, ember `#FF7A4D`, success `#2ADBA0`, track
  `#1A1526`, text `#F4EEDF`). Halftone PNGs regenerated to the correct dark
  card color/opacity.
- **DONE! stamp** on completed Today rows (rotated -6° Bangers, per the
  mock's own tap-zone spec — previously just a plain checkmark).
- **Ember redesign**: `emberSvg.ts` swapped from the old violet-ghost to
  the mock's flame-drop mascot (ember body + gold belly; the exact path
  appears 17× in the mock vs 1 stale ghost instance). Widget-suite only;
  the in-app `components/Ember.tsx` still uses the old design — bringing
  the rest of the app in line is a separate pass.
- **Combo 2×2**: a pre-baked starburst PNG (`scripts/gen-widget-starburst.js`
  — rasterizes the mock's exact 16-point `clip-path` polygon, since
  RemoteViews has no clip-path) with "🔥 / ×N / COMBO!" overlaid; reuses
  the app's own `comboMultiplier()`.
- **Quest 4×2**: honest zero-new-backend version — "quest" = today's real
  due-count (`doneToday`/`totalDue`), progress bar + a "POW! 🪙N" reward
  tag showing the sum of not-yet-earned payouts. (No daily-quest concept
  exists in the data model; inventing one would be a new economy feature,
  out of scope for a widget-visual pass — flagged, not silently faked.)
- Chrome-height row-count budgets (`snapshot.ts`) rebuilt off shared
  `TODAY_BANNER_HEIGHT`/`DAILY_STRIP_BANNER_HEIGHT` constants the widgets
  themselves render with, so a banner tweak can't silently desync the
  row-fit math (the exact class of bug that clipped rows twice before).
- **All 6 widgets device-verified in light + dark** (the mock-match round):
  screenshots confirmed the ink/violet banners, DONE! stamp, real Ember,
  Day-N speech bubble, embedded progress bar, and correct Night-Patrol
  dark swap. `tsc` clean, `vitest` 146/149 (same 3 known drift failures).

### Click-interaction fix (the reported "everything just opens the app")
User: tapping *anywhere* on a widget — including a checkbox row that
should complete a habit — always opened the app; no per-element ticking
from the home screen. Root-caused by reading the library's vendored native
Java (`RNWidget.java`, `WidgetFactory.java`, `ClickableView.java`), two
real **library-level** defects:
1. The lib renders the whole widget to one bitmap and lays every
   `clickAction` down as a separate absolutely-positioned invisible overlay
   in one shared `FrameLayout`, sorted by tree-path id string. A full-bleed
   `OPEN_APP` on the card root (id `"0-0"`) is a string-prefix of every
   row's id, so it *always* sorts first → its full-size hitbox sits
   underneath every row's hitbox in the same container, and the launcher
   resolves overlapping taps to it. **Fix (TSX):** `WidgetCardFrame` gained
   a `rootOpensApp` prop; the two checklist widgets pass `false` and put
   `OPEN_APP` only on their (non-overlapping) header/banner region, so rows
   own their own taps. Matches the mock's tap-zone map (header → open app,
   rows → complete).
2. `registerClickTask` used `(int) System.currentTimeMillis()` as the
   `PendingIntent` requestCode, in a tight loop over every clickable region.
   Since `Intent.filterEquals()` ignores extras, requestCode is the *only*
   thing distinguishing a widget's PendingIntents — and back-to-back
   `currentTimeMillis()` calls routinely collide on the same millisecond,
   collapsing multiple regions onto one `PendingIntent` under
   `FLAG_CANCEL_CURRENT` (tap-one-fire-another). **Fix (patch-package):**
   `patches/react-native-android-widget+0.21.0.patch` changes the
   requestCode to `id * 31 + clickableView.getId().hashCode()` — stable,
   unique per (widget instance, region). Added `patch-package` +
   `postinstall-postinstall` devDeps and a `postinstall: patch-package`
   script so it survives `npm install`.
- `tsc` clean; `vitest` 146/149 (same 3 known drift failures); debug APK
  **built successfully** with the patched native code (`gradlew
  :app:assembleDebug`, BUILD SUCCESSFUL).
- **Device-verified after the phone reconnected**: installed the patched
  APK, watched a live logcat capture through a real tap. The tap fired a
  widget re-render (not `OPEN_APP`) and, crucially, tapping "Exercise"
  specifically completed **only** Exercise — confirmed visually (its row
  alone flipped to green-check on the widget) and confirmed server-side by
  reopening the app and seeing the same real data (coins 398→448, exactly
  Exercise's +50 payout; streak 2→3). Rules out all three failure modes at
  once: doesn't open the app, doesn't misfire onto a different habit,
  reaches the server.
- **Committed and pushed** (`3636cc4` app-icon tuning, `2e6876f` widget
  suite + click fix) — `09920b0..2e6876f` on `main`.

## Motion & haptics — Phase M1: the three ★ marquee animations (done)
Resumed PLAN.md's motion/haptics track: the P2 design's "08 Motion &
Haptics" section specs ~16 animations + a haptic map; decided (via
AskUserQuestion) to build **animations + haptics only** (the §08 section
has no sound catalog, and the 3 existing sound cues — complete/redeem/
level-up, already wired end-to-end through `feedback.ts` — cover what the
spec actually asks for) in **independently-committable phases, marquee
moments first**.

- A prior infrastructure survey found the haptic/sound side of all three ★
  moments was already fully wired (`feedbackComplete`/`feedbackLevelUp` in
  `app/(tabs)/index.tsx`'s completion handler, `feedbackRedeem` in
  `rewards.tsx`) — **this phase is purely the visual choreography**, no
  changes to that orchestration.
- New **`src/components/Confetti.tsx`**: a hand-rolled RN `Animated` burst
  (14 chips, deterministic fan-out — no `Math.random`, so a chip's path is
  stable across re-renders — using the app's own theme colors), gated on
  `useReduceMotion()` (renders nothing when on). Generic, so later phases
  (quest claim, streak milestone) can reuse it rather than each rolling
  their own.
- **Habit complete ★** (`TrackableCard.tsx`, ~900ms): the not-done→done
  *edge* now animates — check scale-in (spring) → card dims to 0.72 via
  `HardShadow`'s `animatedStyle` (one composited fade, not per-child,
  avoiding the shadow-bleed bug fixed earlier this project) → the DONE!/
  RESISTED! stamp springs in. A card that *mounts* already-done (e.g. the
  list re-rendering after a refetch) skips straight to the final state —
  only a genuine live completion animates. Reduce-motion: same instant
  landing. RN can't animate a stroke-draw or `textDecorationLine`, so the
  check "draws" via scale and the strikethrough just appears at the dim
  beat — stated limitation, not glossed over.
- **Level-up ★** (`LevelUpOverlay.tsx`, ~1400ms): was previously just a
  parallel spring+fade. Rebuilt as the spec's real stage sequence: scrim
  fades in → card springs in (unchanged) → `Confetti` bursts → the Ember
  mascot pops (scale+rotate spring). Reduce-motion: static card, no
  confetti, no mascot pop — matches the spec's own stated fallback.
- **Redeem burst ★** (`RedeemSuccessOverlay.tsx`, ~1000ms): was fully
  static (a card + a bare `setTimeout`) with a comment claiming "no real
  sound/haptic yet" that was already stale (haptics/sound have worked
  since an earlier phase — only the visual was static). Rebuilt: card
  spring-in → the existing `Halftone` "rays" layer scales/rotates up →
  several 🪙 chips arc outward (new local `CoinBurst`, same technique as
  `Confetti` but a shorter upward fan) → settles. Kept the ~1500ms
  auto-dismiss unchanged. Removed the stale comment.
- `npx tsc --noEmit` clean; `vitest` 146/149 (unchanged — this phase is
  pure view animation, no new tested logic).
- **Device-verified for crashes/correctness, honest about a real limit on
  frame-level proof**: fresh Metro + relaunch confirmed via bundle-content
  grep. Two live taps (habit-complete ×2 via the Today screen, redeem ×1)
  all completed cleanly — no crash, no JS red-box in logcat, and the
  server-side numbers matched exactly (coins 448→504 on the two habit
  completions, 504→4 on the reward redeem). What I could **not** capture:
  a genuine mid-animation frame. Sequential `adb exec-out screencap`
  round-trips over USB take longer than these animations' own duration, so
  every capture landed on the settled final state, not mid-sequence — a
  real tooling limit, not a claim that the animations were skipped.
  Separately tried to verify the reduce-motion fallback path directly via
  `adb shell settings put global transition_animation_scale 0` (the exact
  setting RN's Android `AccessibilityInfo.isReduceMotionEnabled()` reads,
  confirmed by reading `AccessibilityInfoModule.kt`) — blocked by
  `SecurityException: must have WRITE_SECURE_SETTINGS`, this ROM's shell
  can't write the `global` namespace. (Accidentally set the unrelated
  `system`-namespace animator scales to 0 while investigating; reverted
  them immediately after.) The reduce-motion branches in all three
  components are simple, direct `.setValue()` calls following the exact
  pattern already device-verified in this codebase (`FloatingXp`,
  `UndoToast`, the original `LevelUpOverlay` spring) — high confidence
  from code review, but not live-confirmed this round. A manual spot-check
  (Settings → toggle "Remove animations" → repeat the three actions) is
  the natural follow-up if that confidence isn't enough on its own.
- **Deferred to later phases** (stated in the plan, not silently dropped):
  M2 — haptic map completion (LIGHT on buttons/tabs/steppers, MEDIUM on
  primary actions, WARNING on errors/insufficient-coins/delete-confirm).
  M3 — pervasive motion polish (button squash-press, XP-bar/coin-counter
  tween, modal slide-up, card-list stagger, tab cross-fade). M4 — smaller
  touches (field-error shake, empty-state idle bob, cosmetic-equip morph,
  quest-claim coins-fly, FloatingXp's straight float → true arc-to-bar,
  splash timing tune to the spec's 1200ms).
- **Committed** (`440ef4f`).

## Phase 9 — Gamified stats page (done)
"Move to next phase" resumed PLAN.md §13's numbered v2 roadmap where it
left off (items 6–8 done; the redesign was an ad hoc insertion, not part
of the numbered sequence). Reassessed the gap against PLAN.md §11's exact
spec before building anything, per PLAN.md §13's own note that this phase
is "largely superseded by the Profile screen": Profile already covers
Total XP / an account-wide max streak / a raw habits-done count / current
coin balance, but had **no per-habit breakdown, no coins-earned-over-time,
and no missed-periods view** — the real gap this phase fills.

- New pure-logic module, TDD'd first — `src/features/stats/derived.ts`:
  - `habitStats(trackable, completions, today)` — reuses
    `currentStreak`/`longestStreakEver` from `gamification/streak.ts`
    directly (same functions Profile and `TrackableCard` already call, so
    this can't drift from the app's own streak rules) for
    current/longest streak on every habit; for **day-period habits only**,
    also walks every day from `createdAt` to `today` (reusing `weekday()`
    the same way `currentStreak`'s day-walk already does) to compute
    `completed`/`scheduled`/`completionRate` — `scheduled - completed` is
    the missed-periods count PLAN.md §11 asks for, so no separate function
    was needed. **Week/month-period habits get `completionRate:
    undefined`** rather than a fabricated number — the Stats screen falls
    back to the existing `periodProgress()` "N/M this {week,month}" for
    those instead, which was already correct.
  - `coinsPerWeek(completions, today, weeks=8)` — buckets `coinsEarned`
    (already on every `Completion` row, so no new backend query) by
    `weekStart()`, zero-filled for weeks with no completions.
  - `bestStreakHabit(trackables, completions, today)` — which active habit
    holds the account's longest streak, for the "records" framing.
  - TDD: `src/features/stats/__tests__/derived.test.ts` (8 cases —
    completion rate with missed days, weekday-only scheduling, week-period
    `completionRate` staying `undefined`, coin summing, week-bucket
    boundaries, zero-filled weeks, best-streak picking among several,
    null when nobody has any completions) confirmed red
    (`Cannot find module '../derived'`), then green.
- New screen `app/stats.tsx` — stack-push route outside the tab bar,
  mirroring `app/profile.tsx`'s own pattern exactly (`HardShadow` back
  button, same header/scroll/card conventions): a records row (best-streak
  habit highlighted, total coins earned all-time, total habits/tasks
  done), an 8-week coins-earned bar chart (plain `View`s with percentage
  heights — no new charting dependency, same primitive `LevelBar`'s
  progress track already uses), and a per-habit list (streak, completion
  rate or period progress, coins earned).
- Entry point: `app/profile.tsx` got a new "See full stats →" link below
  the existing stats grid, `router.push("/stats")`.
- **Two items explicitly excluded, stated rather than faked**: best
  league finish (blocked on PLAN.md item 10 — leagues don't exist yet) and
  level history (no stored historical level snapshots to reconstruct from
  — completions record XP earned per completion, not level-at-that-time;
  a real time-series for this is its own separate feature). Archived
  habits are excluded from per-habit stats, the same accepted limitation
  Profile's own longest-streak calc already has.
- `npx tsc --noEmit` clean; full `vitest run`: 88 passing (up from 83 —
  the 8 new stats tests, minus 3 unrelated pre-existing failures in
  `rpc.test.ts` — live Supabase integration tests against a persistent
  test account whose accumulated state has drifted; confirmed via `git
  status` that no file in `src/lib/db/` was touched this phase, so this
  is the same class of live-account flakiness Phase D's verification
  notes already documented, not a regression).
- **Device-verified**: opened Profile → "See full stats" → real numbers
  rendered for the account's actual habits (best-streak habit correctly
  identified, real coin totals, an accurate 8-week chart with only the
  active week populated), no crash, back button returned to Profile
  cleanly. Screenshotted both the Stats screen and the return-to-Profile
  navigation.
- **Not committed** — no commit/push request yet for this phase.

## Phase 10 — League tiers (done)
Resumed PLAN.md §13's roadmap at item 10. Two things PLAN.md left open —
exact tier ladder/promotion rule, and how a weekly rollover happens with
**no server-side cron on this $0-cost stack** (PLAN.md §4) — were resolved
by design (see the plan file for the full reasoning) rather than guessed:

- **5 tiers** (Bronze→Silver→Gold→Platinum→Diamond), rank-based promotion/
  relegation on the *existing* global `weekly_leaderboard` view — no new
  cohort/grouping system, since this app's real user base is tiny and
  couldn't meaningfully fill separate leagues-of-30 anyway. Rule per
  settled week: 0 XP → automatic relegation; rank ≤ `LEAGUE_PROMOTE_TOP`
  (3, among users who earned any XP) → promote; rank in the bottom
  `LEAGUE_RELEGATE_BOTTOM` (3) of that active pool → relegate; otherwise
  unchanged. The bottom-zone formula (`rank > max(active_count - 3, 3)`)
  is deliberately shaped so a small active pool never double-counts a
  user into both the promotion and relegation zones at once.
- **Rollover is lazy and client-triggered, not a cron** — a new RPC,
  `fn_sync_league()`, is idempotent per ISO week (same "safe no-op on
  retry" shape `fn_complete_trackable` already uses), called from the
  Board screen's mount. Whichever user opens Board first after a week
  boundary settles their own row (backfills the just-elapsed week's real
  XP total, decides promote/relegate/stay); everyone else settles on
  their own next visit — safe because league state is per-user, not a
  shared snapshot needing synchronized settlement.
- New `league_standings(user_id, week, tier, xp)` table (Drizzle migration
  + `npm run db:push`), RLS policy matching every other per-user table's
  `user_id = auth.uid()` shape. `LEAGUE_TIERS`/`LEAGUE_PROMOTE_TOP`/
  `LEAGUE_RELEGATE_BOTTOM` added to `gamification/constants.ts`, mirrored
  into SQL via the existing `gen-sql-constants.ts` mechanism so client and
  server can't drift — same pattern `DIFFICULTY_BASE`/`COMBO_TIERS` etc.
  already use.
- **Process note, stated honestly**: this RPC was implemented then tested,
  not test-first — a deviation from the project's own TDD rule for RPCs
  ("written first, confirmed failing, then implemented," which every
  earlier RPC phase this session did follow). The 6 new `rpc.test.ts`
  cases (first-sync seeds Bronze; same-week resync is a no-op; a sole
  active top performer promotes; a zero-XP week relegates; ranking in the
  bottom of a real 5-person active pool relegates despite nonzero XP,
  using new `makeCompetitor()`/`seedLeagueStanding()` test helpers;
  Diamond never over-promotes) all passed on the first run against the
  already-applied SQL, so the logic is verified, just not via the red-
  first ritual for this one function.
- Client: `leaderboard/api.ts` gets `syncLeague()`/`fetchMyLeague()`;
  `useLeaderboard.ts` gets `useSyncLeagueOnMount()`. `app/(tabs)/
  leaderboard.tsx` ("Board" — leagues extend it in place, per PLAN.md's
  own "weekly leagues... on the leaderboard" framing, not a new tab) gets
  a tier badge in the header and a relegation-zone "↓" tag on qualifying
  rows; the zone hint text and tags only render when the *active* pool
  (weekly XP > 0, not the raw row count — `weekly_leaderboard`'s own view
  includes every profile ever signed up, active or not) is bigger than
  the relegate-zone size, so a tiny real population never gets swallowed
  into a meaningless "everyone's in danger" state.
- `npx tsc --noEmit` clean; full `vitest run`: 94 passing (up from 88 —
  the 6 new league tests), same 3 pre-existing unrelated `rpc.test.ts`
  failures as Phase 9 (confirmed unchanged, still live-account state
  drift, not this phase's code).
- **Device-verified**: Board screen shows a correct "BRONZE" tier badge,
  loads with no crash, "You" ranks correctly, and the relegation hint
  correctly stays hidden since only 2 real users are active this week
  (not enough for the zones to be meaningful) — confirmed the graceful-
  degradation design works as intended, not just in theory. One mid-
  session hiccup, unrelated to this phase's code: the `adb reverse
  tcp:8081` tunnel dropped twice more during this session (device
  connection instability, not a code bug), fixed the same way as before.
- **Known dev-environment artifact, not a regression**: the live Board
  now visibly shows several `habiteer.rpctest.other.*` accounts at 0 XP
  — leftover fixtures from `makeOtherUser()`, a pattern earlier group
  tests already used before this phase (those test accounts can't be
  deleted without admin/service-role privileges the anon-key test client
  doesn't have). `weekly_leaderboard`'s view includes every signed-up
  profile regardless of activity, so this was already true before this
  phase; this phase's new `makeCompetitor()` helper just adds a few more
  such accounts to the pile. Cosmetic only — harmless to real usage.
- **Committed + pushed** (`4ca34ad`).

## Phase 11 — Cosmetics catalog + capability unlocks (done)
Resumed PLAN.md §13 at item 11. Reassessed against §9's bullet first: most
of "capability unlocks" (Lv 3 groups/shared-rewards, Lv 5 advanced
recurrence) already ship as real `caller_level()` RLS gates, so the genuine
gap was the **cosmetics catalog** (nothing existed) + "Lv 2 custom colors."

- **Ships**: milestone-gated avatar colors (violet L1 / jade L2 / fire L5 /
  yellow L10 / ink L20) and titles (Novice L1 / Builder L5 / Master L10 /
  Legend L20), equippable from a new `app/cosmetics.tsx` screen (stack-push,
  mirroring `app/stats.tsx`'s pattern), reached via a "🎨 Cosmetics" link on
  Profile. Equipped color drives Profile's avatar AND the Today-header avatar
  button; equipped title shows as a caption under the Profile name.
- **The gate is RLS, not an RPC — deliberately.** Pressure-testing the plan
  (at the user's "look for gaps/edge-cases" request) surfaced that the
  obvious `fn_equip_cosmetic` RPC would be pure theater: the `"own profile"`
  policy had no WITH CHECK, so a client could `UPDATE profiles SET
  avatar_color='ink'` directly via PostgREST at level 1 and bypass the RPC
  entirely. Resolved by following the trackables level-5 gate's own pattern —
  the Phase-1 `"own profile"` policy is dropped and recreated at the end of
  `rls.sql` with `with check (id = auth.uid() and caller_level() >=
  avatar_color_unlock_level(avatar_color) and caller_level() >=
  title_unlock_level(title_id))`. The client just does a direct `profiles`
  update; the DB is the enforcement. No RPC added.
- Other gaps caught + resolved in the plan pass: (a) the WITH CHECK re-runs
  on display-name-only updates too, but stays safe because levels never
  decrease and defaults are L1; (b) unknown ids map to unlock level `9999`
  (generated SQL) so a tampered id fails the same gate; (c) yellow needs an
  ink initial not white — each catalog color carries its own `textColor`,
  mirroring the leaderboard tier badge; (d) equipped color wired to BOTH
  Profile and the Today header so they can't diverge; (e) `handle_new_user`
  needs no change (new columns have NOT NULL defaults).
- **Scoped out, stated not dropped**: card skins (invasive `TrackableCard`
  threading — deferred), full themes (same as full dark mode, always
  deferred), "more habit slots" (no habit cap exists to gate — inventing one
  wasn't asked for), and surfacing others' cosmetics on the leaderboard (a
  "flex to others" nice-to-have needing the columns in `weekly_leaderboard`).
- **Structure**: id→unlock-level maps live in `gamification/constants.ts`
  (import-free, so the Node SQL generator consumes them; mirrored to SQL via
  `gen-sql-constants.ts` — same anti-drift mechanism as every other constant);
  visual details (hex/textColor/label) in a client-only
  `features/cosmetics/catalog.ts` that imports `theme`. Two new NOT NULL
  `profiles` columns (`avatar_color`, `title_id`) via Drizzle migration
  `0004_*` + `db:push`.
- **TDD**: 4 `rpc.test.ts` cases (equip an unlocked cosmetic succeeds; one
  above level rejected by RLS; unknown id rejected; display-name-only update
  still succeeds) — confirmed RED first (happy path failed on the missing
  column), then GREEN after `db:push` + `db:apply-sql`, with rejects now
  failing for the right reason (the gate, not a missing column). New
  `testClient.ts` helpers reset cosmetics to L1 defaults after each test so a
  seeded-then-cleaned-up high level never leaves the persistent account in a
  state where the WITH CHECK blocks later profile updates.
- `npx tsc --noEmit` clean; full `vitest run`: 98 passing (up from 94 — the
  4 new cosmetics tests), same 3 pre-existing unrelated failures ([[see
  dev-db-test-drift]] / the "Known dev-environment artifact" notes above).
- **Device-verified**: Profile → 🎨 Cosmetics; locked items show their
  required level, equipping an unlocked color/title updates the Profile
  avatar + Today header + title caption, no crash (user-confirmed).
- **Not committed** — no commit/push request yet for this phase.

## Phase 12 — Reduction mode + core-loop fixes (done, device-test deferred)
Reduction mode (PLAN.md §13 item 12, the last numbered v2 item) shipped as
"simple abstention" (user's pick over a richer targets/partial-credit
mechanic): a `goal_type` column ('build' default / 'reduce') on trackables,
descriptive only — a reduce habit reuses the whole completion/streak/coin/XP
engine, only the framing differs. Then the user raised three core-loop fixes,
folded into the same batch (same files):

1. **Undo unified to toast-only, then locked (Case 1).** A habit could be
   undone indefinitely by re-tapping its done card — removed. Now every
   completion (habit + task) shows the transient `UndoToast` (~4s); while it's
   up, UNDO reverts; once it dismisses the completion is locked for the day
   (the done card's check is non-interactive). `index.tsx` always
   `setUndoToastFor(t)` + early-returns on an already-done tap; `TrackableCard`
   drops the done-state undo affordance. Next-day reset (Case 2) makes it
   actionable again — no separate "locked" store needed.
2. **Day reset (Case 2).** `today()` is UTC-derived and recomputes per render,
   but nothing forced a refetch at midnight. Wired TanStack Query's
   `focusManager` to `AppState` in `app/_layout.tsx` — foregrounding refetches,
   so a habit left done overnight resets on reopen. Accepted gap: an app left
   *continuously foregrounded* across midnight won't fire (no timer added).
3. **Tasks scheduled to a day (Case 3).** New nullable `due_on` column;
   `filterDueToday` for a task returns `dueOn == null || dueOn <= today` —
   unscheduled = always due (unchanged), future = hidden until its day, then
   shows until done (overdue one-offs persist). Confirmed via TDD in
   `today.test.ts`. Panel gets a "When" preset row (Anytime/Today/Tomorrow/In
   a week + a ±day stepper — user chose presets over a native date-picker dep,
   so **no native rebuild**, just a DB column). Card shows the date as its
   schedule label. Flows to the widget free (reuses `filterDueToday`).
- Reduction UI: TrackablePanel "Goal" toggle (habit-only); `TrackableCard`
  reframes via a tiny TDD'd `reductionFraming()` helper (RESISTED ✓ / 🛡️ /
  REDUCE pill); `UndoToast` gains a `doneVerb` prop ("Resisted" for reduce).
- **⚠️ Live-DB incident found + fixed mid-phase:** the two `db:push` calls
  this phase (for `goal_type`, then `due_on`) silently **wiped all RLS** —
  drizzle-kit reconciles only schema columns, not the hand-authored policies
  in `rls.sql`, and left every table with RLS **disabled** and all 12 policies
  dropped (a real anon-key security hole). Caught because RLS-dependent
  `rpc.test.ts` cases (ownership filtering + the WITH-CHECK gates) started
  failing "expected null not to be null". Fixed by re-running `db:apply-sql`
  (idempotent); verified via `pg_class.relrowsecurity` (all true) + 12
  policies restored. **Lesson (now in memory): always `db:apply-sql` after any
  `db:push`.**
- **TDD**: `today.test.ts` task-`dueOn` cases + `reductionFraming` test — both
  red-first, then green. `npx tsc --noEmit` clean; full `vitest run` back to
  101 passing / the same 3 pre-existing drift failures (freeze ×2 + level-5
  gate — all shared-account level inflation, RLS confirmed healthy).
- **Device test deferred by the user** — the three cases + reduction framing
  are code-complete and tsc/test-verified but not yet screenshotted on device.
- **Uncommitted** — Phases 11, 12, and this batch are all still in the working
  tree awaiting a commit request.

## Phase 13 — Cosmetics tails: leaderboard surfacing + account-wide card skin (done, device-test pending)
Post-roadmap extension of Phase 11 cosmetics — the user chose the two deferred
tails: surface others' equipped cosmetics on the Board + one account-wide card
skin (not per-habit skins, which would thread fragile state through
`TrackableCard`).

- **Leaderboard surfacing** (no new column — the columns exist from Phase 11):
  `weekly_leaderboard` view extended to expose `avatar_color`/`title_id`
  (appended after the existing columns — `CREATE OR REPLACE VIEW` requires
  existing columns keep their order; verified). `leaderboard/api.ts` maps them;
  `leaderboard.tsx` renders each row's initial-letter avatar in that player's
  equipped color (+ its `textColor`) and shows a non-default equipped title as
  a caption under the name (default 'novice' suppressed as noise). The top-3
  medal/row-fill treatment is unchanged; only the avatar swatch color + title
  caption are new.
- **Account-wide card skin**: new `card_skin` profiles column ('plain' default
  + cream/mint/lavender/peach, all **light tints** so the card's ink text stays
  readable — deliberately no dark skin to avoid a contrast refactor). Level-
  gated exactly like avatar_color/title_id: `CARD_SKIN_LEVELS` in
  `gamification/constants.ts` → generated `card_skin_unlock_level()` → a new
  clause in the `profiles` WITH CHECK. `index.tsx` resolves the equipped skin
  via `cardSkinFor(profile.cardSkin).bg` and passes one `skinBg` prop to each
  `TrackableCard` (which applies it as the card background, default white) —
  single prop, no per-card state, minimal touch to the fragile card. New "Card
  skin" section on `app/cosmetics.tsx` with the same locked/equipped swatches.
- **TDD**: 3 new `rpc.test.ts` card-skin gate cases (equip unlocked succeeds;
  above-level rejected by RLS; unknown id rejected) — red-first (column/gate
  absent), green after push + apply.
- **db:push RLS wipe — handled correctly this time**: the `card_skin` push
  again disabled RLS (as expected per the memory note), immediately followed by
  `db:apply-sql`; verified `pg_class.relrowsecurity` all-true + 12 policies +
  the view's new columns before running tests. No security window left open.
- `npx tsc --noEmit` clean; full `vitest run`: 104 passing (up from 101 — the 3
  new card-skin tests), same 3 pre-existing drift failures only.
- **Device test pending** — code-complete + tsc/test-verified; not yet
  screenshotted on device (offered to the user). This closes the cosmetics
  tails and there is no further planned scope.
- **Uncommitted** — now Phases 11, 12, and 13 are all in the working tree.

## v3 (post-roadmap, competitor-gap driven) — Reminders + Sounds/Haptics (done, native rebuild + device-test pending)
A deep-research pass (fanned-out, source-verified) over gamified competitors
(Finch, Duolingo, Habitica, …) ranked the top additive gaps for Habiteer.
**Gap #1 (habit reminders)** and the long-stubbed **sounds/haptics** were built
together as the first v3 batch.

### Reminders — on-device local notifications (`expo-notifications`, $0, no server)
- **Data**: new nullable `trackables.reminder_time` text column ("HH:MM" 24h;
  null = no reminder). Threaded through `schema.ts`, `schemas.ts` (regex-
  validated `reminderTime`), and `api.ts` (`Trackable` type + mapRow +
  create/update). Descriptive, gates nothing → no RLS clause. Migration
  `drizzle/0008_bitter_lilith.sql` (single ADD COLUMN).
  - **db:push RLS wipe — handled**: after the push, re-ran `db:apply-sql`;
    verified via direct `pg_class`/`pg_policies` query that RLS is enabled on
    all 10 tables (none disabled) + 12 policies present + the new column
    exists. No security window left open.
- **Pure logic (TDD)**: `src/features/reminders/schedule.ts` →
  `notificationRequestsFor(trackable, now)` returns expo-agnostic trigger
  descriptors — daily habit → 1 DAILY trigger; specific-weekday habit → N
  WEEKLY triggers (our 0=Sun mapped to expo's 1=Sun); week/month-quota habit →
  a daily nudge; task with `dueOn` → one-off DATE trigger (skipped if the slot
  is already past); no `dueOn`/null/malformed time → none. Reduce habits get
  "resist"-framed copy. `schedule.test.ts` (11 cases) written first, confirmed
  RED, then GREEN.
- **Effect layer**: `scheduler.ts` — `syncReminders(trackables)` does a full
  cancel-all + reschedule (robust vs. drift after edits/archives/reinstalls),
  `requestReminderPermission()` (+ Android channel), a master
  `remindersEnabled` toggle (defaults on), `disableReminders()`. Mapped onto
  expo `SchedulableTriggerInputTypes`. `useReminderSync` hook re-syncs on
  trackables-change and on foreground; wired in `index.tsx`.
- **UI**: `TrackablePanel` gains a "Remind me" row — preset chips (Off / 8AM /
  12PM / 6PM / 9PM) + a ±15-min stepper (no new datepicker dependency; reuses
  the panel's chip/stepper idiom). Shown for any habit and for dated tasks
  (an anytime task has no time anchor). `profile.tsx` "Reminders" row is now a
  **real master toggle** (was a fake "9:00 AM ›") that requests permission +
  reschedules, or cancels all.
- **Native**: `app.config.ts` adds the `expo-notifications` plugin (monochrome
  status-bar icon + violet tint) and `expo-audio` plugin; `_layout.tsx` sets
  the foreground notification handler. **Requires `expo prebuild` +
  `run:android`** (native module — not Fast Refresh).

### Sounds & haptics — wires up the previously-dead Profile toggles
- **Assets**: 3 self-contained WAV cues synthesized by `scripts/gen-sfx.js`
  (additive synth + ADSR envelope, no external audio packs, stays $0/offline):
  `assets/sfx/{complete,redeem,levelup}.wav`.
- **Module**: `src/features/feedback/feedback.ts` — `feedbackComplete/redeem/
  levelUp()` fire `expo-haptics` + `expo-audio` playback, gated by a
  module-level cache of the `sound`/`haptics` settings (so the completion hot
  path stays synchronous). `loadFeedbackSettings()` called at app init;
  `setFeedbackSetting()` keeps the cache in step when a Profile toggle flips
  (avoids an AsyncStorage read-back race). Players created lazily + reused; all
  playback is fire-and-forget.
- **Wired**: completion + level-up (`index.tsx`), redeem (`rewards.tsx`). The
  Profile "Sound effects"/"Haptics" toggles now actually do something.

### Verification
- `schedule.test.ts` red→green; `npx tsc --noEmit` clean; full `vitest run`:
  **115 passing** (up from 104 — the 11 new reminder tests), same 3 pre-
  existing shared-account drift failures only (freeze ×2 + level-5 gate).
- **Device-verified (2026-07-23)** on the MIUI device after a clean native
  rebuild. Confirmed live: the reminder picker (presets + ±15-min stepper)
  renders; saving a habit with a reminder fires the Android notification-
  permission prompt (granted) and schedules a real `RTC_WAKEUP` alarm at the
  chosen time (verified via `dumpsys alarm` — daily 8:30 AM → tomorrow
  08:30); completing a habit produces the haptic buzz + "pop" sound (user-
  confirmed); reduction framing (Phase 12) shows RESISTED/REDUCE/🛡️ on the
  card. Level-up/redeem cues share the same feedback path (only the WAV
  differs), so covered by the completion path.
  - **Native-build gotchas hit & fixed during the device pass** (recorded in
    memory): (1) `npx expo install expo-audio` let npm resolve a FUTURE
    transitive `expo-asset@57.0.7` (SDK-55+) whose `AssetModule` references
    `expo.modules.kotlin.types.AnyTypeCache` — absent in SDK-54's
    `expo-modules-core@3.0.30` → `NoClassDefFoundError` native crash on launch
    (invisible to `expo install --check`, which said "up to date"). Fixed by
    pinning `expo-asset` to 12.0.13 + clean rebuild. (2) The version churn left
    a corrupted nested `node_modules/expo-asset/node_modules/expo-constants`
    (missing `build/`) → Metro 500 on bundle. Fixed by `rm -rf` the nested dir
    + `npm install` + fresh Metro `--clear`.
- **Uncommitted** — this v3 batch joins Phases 11/12/13 in the working tree.

## v3 Gap #3 — Group shared streak (social accountability) (done, device-test pending)
Second competitor-gap build (the research's relationship-accountability lever,
+22% daily completion for shared streaks). Implemented as a **group shared
streak** reusing the existing groups (Habiteer's mutual-invite "known people"),
not a new pairwise-friend system.

- **Mechanic**: a group's streak = consecutive days on which EVERY current
  member logged ≥1 completion ("showed up"); resets when anyone misses. Mirrors
  the personal day-streak grace (today never counts as a miss until the day
  ends). Plus a per-member "done today?" row for the nudge (✅ You / ⏳ Alex).
- **Server**: one new security-definer RPC `fn_group_activity(p_group_id,
  p_since)` → `(user_id, day)` rows, deriving active days from `completions`
  for all members of a group the caller belongs to (guarded: non-members get an
  exception). Exposes activity DAYS only, never habit details, so RLS stays
  owner-private on `completions`. **No schema change → no `db:push` → no
  RLS-wipe risk**; applied via `db:apply-sql`. Because it derives live from
  completions, undo needs no special handling.
  - **Fixed a latent rls.sql non-idempotency along the way**: the
    `league_standings` policy had no `drop policy if exists` guard, so
    `db:apply-sql` without a preceding push-wipe failed ("policy already
    exists") — which had been masked because every prior apply followed a
    push that wiped policies first. Added the guard; apply-sql is now cleanly
    idempotent on the SQL-only path. Verified 12 policies, 0 RLS-disabled
    tables, RPC present.
- **Pure logic (TDD)**: `src/features/groups/streak.ts` — `groupStreak()` +
  `membersDoneToday()`. `streak.test.ts` (8 cases: all-done incl today; today
  grace holds through yesterday; past-miss breaks; grace-then-break-to-0;
  single-member = own streak; empty; non-member rows ignored) red→green.
- **Client**: `fetchGroupActivity` + `useGroupActivityQuery`; `group/[id].tsx`
  gains a "🔥 N-day group streak" banner + a Today per-member ✅/⏳ status row
  (self labeled "You"; other members' names remain RLS-limited as before).
- **Freeze auto-apply (research's other streak lever) was already built** —
  `fn_complete_trackable` already bridges missed scheduled days by spending
  freeze tokens. No work needed; noted rather than padded.
- `npx tsc --noEmit` clean; full `vitest run`: **123 passing** (up from 115 —
  the 8 group-streak tests), same 3 pre-existing drift failures.
- **Deferred, stated**: time-limited quests/events (Gap #3's other lever — a
  distinct larger system); a dedicated pairwise-friends model (groups already
  serve).
- **Device-verified (2026-07-23)**: seeded a "Streak Squad" group for the
  device account (mouli9517) directly via the DB (bypassing the Lv3 create
  gate); the group screen showed "🔥 2-day group streak" + a Today row with a
  green "✅ You" chip — streak = 2, matching the account's 07-23 + 07-22
  activity. Full path (RPC → fetchGroupActivity → groupStreak → UI) confirmed.
  Multi-member ⏳ state not shown on-device (needs a 2nd account with activity);
  covered by the unit tests. NOTE: a "Streak Squad" test group remains on the
  live account — harmless seeded data, remove if unwanted.
  - **Metro stale-bundle gotcha (cost several device cycles)**: the running
    Metro's file watcher silently missed the newly-created `groups/streak.ts`
    etc., so it kept serving a bundle WITHOUT the new screen — the group screen
    rendered its old layout through multiple app cold-restarts. Diagnosed by
    `curl localhost:8081/index.bundle | grep "<new UI string>"` → 0 matches.
    Fixed by killing Metro on 8081 and restarting `expo start --clear`;
    re-grepped the bundle (1 match) before the device showed the new UI.

## v3 Gap #3 (cont.) — Weekly quests + limited-time events (done, device-test pending)
The research's urgency lever. Weekly challenges with a progress bar + a
one-time coin reward, derived from this week's completions; "events" are the
same mechanic time-boxed to a date window.

- **Catalog** in `gamification/constants.ts` (import-free): `QUESTS` with
  `{id, metric, goal, reward, activeFrom?, activeUntil?}`. Metrics
  (completions / active_days / coins_earned) are week-scoped and computed
  identically in TS and SQL. Goals/rewards/metrics/windows mirrored into SQL
  via `gen-sql-constants.ts` → `quest_metric/goal/reward/active_from/
  active_until()` so the claim RPC and client can't drift.
- **Reward = coins only** (never XP — would perturb levels/leagues), bounded
  (~one claim per quest per ISO week), credited through the same `coin_ledger`
  path as rewards with a new `'quest'` kind added to its CHECK constraint.
- **Server**: `quest_claims(user_id, quest_id, week, reward)` table (unique on
  the triple → idempotent). Security-definer `fn_claim_quest(quest_id)`
  recomputes the metric server-side for the current week from completions
  (never trusts the client), checks goal + event window + not-already-claimed,
  then inserts the claim + a `'quest'` ledger credit. Migration `0009`.
  **db:push wiped RLS as expected → re-ran `db:apply-sql`; verified 13 policies
  (12 + own-quest-claims), 0 RLS-disabled, all 6 quest fns + the table + the
  `'quest'` kind constraint present.**
- **Events = limited-window quests**: an optional activeFrom/activeUntil makes
  a quest hidden + unclaimable outside its window (client + RPC enforced); one
  example (`weekend_warrior`, this-week window, 60-coin reward) with an
  "Xd left" countdown. Windows are hand-configured (no cron).
- **Pure logic (TDD)**: `quests/derived.ts` (`questMetricValue`, `questStatus`,
  `activeQuestStatuses`), 9 cases red→green. Plus 3 `rpc.test.ts` claim cases
  (unknown-id rejected; met → credits 50 once then second claim rejected;
  unmet rejected) using a `cleanupQuests` helper.
- **Client/UI**: `quests/{api,useQuests,catalog}.ts`; new stack-push
  `app/quests.tsx` (progress bars + Claim buttons + event countdown); entry via
  a "🎯 Weekly quests" banner on the Board (`leaderboard.tsx`).
- **Also fixed** the latent `rls.sql` league-policy non-idempotency (added its
  drop-if-exists) — same fix noted under group-streak.
- `npx tsc --noEmit` clean; full `vitest run`: **135 passing** (up from 123 —
  9 quest-logic + 3 claim-RPC tests), same 3 pre-existing drift failures.
- **Deferred, stated**: economy multipliers (double-coin weekends — touches the
  hot completion payout path); auto-rotating/scheduled events (needs cron);
  XP/cosmetic quest rewards.
- **Device-verified (2026-07-23)**: Board → 🎯 Weekly quests showed real
  progress (Busy Bee 12/15, Steady 2/5, Coin Rush 200/200, Weekend Warrior
  event 8/8 with a "4d left" tag). Claiming Coin Rush (+50) and Weekend
  Warrior (+60) credited exactly 110 quest coins (balance 192 → 302, confirmed
  in the ledger) and locked both to "Claimed ✓" (idempotent). Full path
  (fn_claim_quest → coin_ledger → balance) proven, including the event window.
  Hit the same Metro stale-bundle trap first (quest files missed) — fixed by
  the documented `expo start --clear` + bundle-grep before reloading.

## Server hygiene + offline indicator (done)
- **Purged 284 accumulated `rpctest.other` test users** from the live DB
  (transactional, FK-safe; 5 real accounts remain). DB back to a clean 13 MB
  of the 500 MB free-tier cap.
- **Stopped the accumulation at the source:** `makeOtherUser` now reuses a
  **stable buddy pool** (buddy1, buddy2, … — sign-in-or-signup + reset own
  rows on acquire) instead of signing up a throwaway every run. League/group
  tests still green, so distinct simultaneous rivals still work.
- **Backup path** (free tier has NO automated backups/PITR): `npm run db:backup`
  → `scripts/backup.ts` dumps all public-schema rows + an auth-users snapshot
  to a timestamped JSON in `backups/` (git-ignored — user data). Schema itself
  is already in git (migrations + rls/rpc/constants SQL). Verified: 11 tables /
  1231 rows.
- **Offline / "not saved" indicator:** a global `<ConnectionToast>` (top banner,
  fire-colored, warning haptic, auto-dismiss) fires when a query/mutation fails
  on the network — wired via TanStack Query `QueryCache`/`MutationCache`
  `onError` in `app/_layout.tsx`, gated by a TDD'd `isConnectionError()` (4
  cases) so only network failures trigger it (business/validation errors keep
  their own specific handlers). Copy is honest: mutations say "Couldn't save —
  you're offline…"; queries say "Can't reach the server — showing your last
  saved data." `tsc` clean; full suite 139 passing / same 3 drift failures.
  - Note: on a network failure a mutation's own `Alert` may also fire alongside
    the banner — acceptable now; can consolidate in the upcoming redesign.
  - Device test pending (needs airplane-mode to simulate offline).

## v2 front-end overhaul — P2 "Questlight" comic-RPG (done)
Full visual/UX overhaul to the user's Claude-Design "Habiteer P2 — Screens"
deliverable (Direction A · palette-1 "Questlight" · type-3 "Action Panel":
Bangers headers, Space Grotesk body, Space Mono numbers · icon-A "Evolved-H" ·
mascot Ember). Every value pulled from the deliverable's live DOM, not eyeballed.
Local commits `b061990` (foundations) → `224700b` (card + level bar) →
`242f0d6` (all screens) → `e2548c9` (icon) → `5e9bd09` (widget).

- **Foundations**: `constants/theme.ts` repointed to Questlight tokens (+ semantic
  hero/gold/ember/success/info/danger, `on{}`, radii/borders/depth); `fonts.ts`
  adds Bangers; new `components/Ember.tsx` (mascot) + `components/Halftone.tsx`
  (dot-grid ground, react-native-svg).
- **Every screen rebuilt element-by-element to the mocks** — Today (Ember tile,
  Bangers wordmark, coin/freeze chips, halftone, level banner, DONE!/RESISTED!
  cards), **BottomHUD** (floating ink island, solid-gold filled house active
  tab, exact icon set, ember "+" in a center well), Rewards (light-violet emoji
  tiles, ember cost, locked treatment, inline dashed +Add), Board ("LEAGUE"
  banner + numbered square-avatar rows + promotion/relegation zones), Profile
  (centered avatar tile + LVL·title pill + 2×2 stat grid), Groups (JOIN A PARTY
  panel + dashed create; detail: ember streak banner, invite+Share, member
  rows), Stats (ember/success record cards, coin bar chart, per-habit bars),
  Cosmetics, modals (Bangers titles + color-coded buttons), overlays (level-up
  hero card + Ember, undo ink bar, redeem burst), panels + sign-in.
- **App icon** "Evolved-H" via committable `scripts/gen-icon.js` (dependency-free
  PNG encoder + 4× supersample); regenerates icon + adaptive fg/bg/monochrome;
  widget-icon plugin copies it into the widget on prebuild.
- **Widget** rebuilt to the "Today 4×2" mock (paper card, app-icon header +
  "TODAY · N/M" + streak + coins, checkbox rows); dropped the crash-prone
  OverlapWidget clock; added `doneToday`/`totalDue` to the snapshot (TDD).
- **Two product decisions with the user**: HUD keeps Groups as the 4th tab
  (Profile via the header Ember tile); avatars stay initial-letter (recolored),
  not Ember; inline dashed add buttons kept alongside the floating "+"; widget
  header uses the app icon (not Ember).
- **Verification**: `tsc` clean throughout; suite **139 passing** (same 3 known
  `rpc.test.ts` drift). Device-verified (2026-07-24): HUD/Today/Rewards/Board/
  Profile/Groups/Stats/Cosmetics screenshots, the Evolved-H launcher icon, and
  the widget (dark variant). Not screenshotted (MIUI blocks `adb input`): the
  add/edit sheet + sign-in (tsc/pattern-verified only).
- **Known follow-up**: Groups *list* card shows the invite code, not
  "🔥streak · N members" — the list query lacks those (they live on the detail
  query); surfacing them needs a small query extension. RemoteViews widget
  limits (no custom font/shadow/strikethrough) are inherent, stated in-file.

## Bugs / blockers
- Phases 12 & 13 device verification pending (user deferring); v3
  reminders/sound + Gap #3 group-streak ARE device-verified. Quests device
  test pending (above).
- Otherwise none blocking. See "Known follow-ups" for accepted v1/v2 gaps.

## Phase U (partial) — pre-scoped correctness fixes, ahead of the user's UI/UX list

Roadmap context: after M1 (3★ marquee animations, shipped `b40ab30`), the plan
is UI/UX fixes (Phase U) → motion M2–M4 → notifications → quest coherence →
research wedges, with point-3 strategic bets parked for hard launch. Phase U
itself is still blocked on the user's own list of UI/UX issues — not yet
provided — but two correctness bugs were already pre-scoped into it (found by
two Explore-agent audits earlier this session) and fixed now since they don't
depend on that list:

1. **Two false doc comments corrected.** Both were self-inflicted errors from
   earlier in this session, corrected via firsthand source reading:
   - `src/features/profile/useBoolSetting.ts` claimed Reminders is a UI stub
     and sound/haptics aren't wired — both false. Reminders
     (`src/features/reminders/`) is a fully real scheduling system; sound/
     haptics are wired via `src/features/feedback/feedback.ts`. Comment now
     describes this toggle correctly as the master on/off switch each reads.
   - `src/features/widget/QuestWidget.tsx` claimed no quest backend exists —
     false; `quest_claims`/`fn_claim_quest` is a real, server-authoritative
     weekly quest system (`app/quests.tsx`). Comment corrected to note the
     widget is a deliberate `doneToday`/`totalDue` stand-in, not evidence of
     a missing backend — the actual rewire to real quest data is its own
     future phase (Phase Q), not done here.
2. **`app/stats.tsx`'s `?? "week"` period fallback, fixed.** The per-habit
   loop only iterates `kind === "habit"` rows, and `TrackablePanel.tsx`
   always assigns habits an explicit `period` ("day"/"week"/"month") at
   creation — `null` is reserved for tasks only — so the fallback was
   defensive dead code today, not a live bug. Still fixed properly rather
   than left as a smell: `periodProgress` is now only called when
   `t.period` is genuinely `"week"` or `"month"`; anything else (day, or a
   hypothetical null) falls through to `rate = 0` instead of being silently
   scored against a weekly quota it doesn't have.
3. **`completions/api.ts` no longer drops `freezeSpent`/`freezeGranted`.**
   `mapCompletionRow` mapped every column off a `completions` row except
   these two (`freeze_spent`/`freeze_granted`, populated by
   `fn_complete_trackable` in `rpc.sql` on the completion that spent/granted
   a token) — so no UI could ever have shown that a freeze token was
   consumed, even though the data was already sitting in the DB row.
   `Completion` now carries both fields. This is a data-availability fix
   only, not new UI — deliberately, since *showing* this (the "a freeze
   token protected your streak" moment) is Phase R's scope (the long-horizon
   goal reframe), not a bolt-on here. Four test-fixture helpers
   (`quests/__tests__/derived.test.ts`, `widget/__tests__/snapshot.test.ts`,
   `completions/__tests__/derived.test.ts`, `stats/__tests__/derived.test.ts`)
   had their `Completion`-typed literals updated to match the wider type.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded — this repo's rtk hook mangles direct
  vitest output): **146/149**, the exact same 3 pre-existing live-DB-drift
  failures in `rpc.test.ts` as every prior round (freeze-token level-boundary
  grants, undo-revokes-token, level-5 gate) — no new regressions.
- No device test needed — this batch is pure logic/type correctness with no
  new visible surface (the comment fixes touch no rendered UI; the
  `stats.tsx`/`completions/api.ts` fixes don't change any current behavior
  for real data, only the null/mis-scope edge case and a previously-invisible
  data field).
- **Not committed** — awaiting the user's UI/UX list so Phase U ships as one
  batch, per the approved roadmap ("their choice, and the right one... doing
  motion first would build on layouts that then shift underneath").

## Phase M2 — Haptic map completion

Roadmap context: with Phase U's UI/UX list still not in hand, moved ahead to
the next unblocked item in the approved point-2 order (Motion M2–M4 →
notifications → quest backend). Before this phase only SUCCESS
(complete/redeem) and HEAVY (level-up) were wired, via
`src/features/feedback/feedback.ts`. This phase adds the three missing
buckets — LIGHT, MEDIUM, WARNING — centralized rather than sprinkled per-call-
site, per the plan's own framing.

- **`feedback.ts`** gained `feedbackLight`/`feedbackMedium`/`feedbackWarning`
  — thin wrappers around `Haptics.impactAsync(Light/Medium)` and
  `Haptics.notificationAsync(Warning)`, gated by the same `hapticsEnabled`
  cache every existing feedback function already uses.
- **LIGHT is now `HardShadow`'s default.** `HardShadow` (the universal
  shadowed Pressable/View wrapper, ~26 files / 130+ call sites) gained a
  `haptic?: "light"|"medium"|"warning"|"none"` prop; any `onPress` fires
  LIGHT automatically unless overridden — the "one change, not fifty" the
  plan called for. One real false-positive found and fixed: `Modal.tsx`'s
  card wrapper passes `onPress={(e) => e.stopPropagation()}` purely to stop a
  tap-anywhere-inside-the-card from bubbling to the scrim's dismiss handler —
  not a real user action, so it got `haptic="none"` to avoid buzzing on every
  tap inside any modal. `BottomHUD.tsx`'s 4 tab buttons are raw `Pressable`s
  (not `HardShadow`), so they got an explicit `feedbackLight()` call instead;
  its floating "+" is already a `HardShadow`, so it picked up the default
  for free.
- **MEDIUM** on primary commits. `ModalButton` (`Modal.tsx`) now maps its
  color variant to a haptic: `jade`/`fire`/`ink` (Redeem confirm, Delete,
  Sign out — real committed actions) → medium; `cancel`/`info`/`violet`
  (Cancel, "Got it", "Keep earning" — dismissive/acknowledging, not a commit)
  stay at the LIGHT default. This covers Redeem confirm per the plan, plus
  Delete/Sign-out by the same logic (not explicitly named in the plan, but
  the identical "committing to a real action" reasoning applied consistently
  rather than special-cased). `TrackablePanel`'s Save and
  `CreateOrJoinPanel`'s Join/Create both got an explicit `haptic="medium"`
  override (plain `HardShadow` buttons, not `ModalButton`s).
- **WARNING** on the two existing risk/blocked-action surfaces.
  `InsufficientFundsModal` and `DeleteConfirmModal` each gained a
  `useEffect(() => { if (visible) feedbackWarning(); }, [visible])` —
  the exact pattern `ConnectionToast.tsx` already uses for network errors
  (fire when the warning-signaling UI *appears*, not on a later button tap).
  Both are conditionally mounted by their parent screens (`{x && <Modal
  visible .../>}`), so the effect fires correctly on mount.
- **"Form validation failures" (named in the plan's WARNING bucket) is
  explicitly NOT wired this pass** — there is no error-surfacing UI path to
  hang it on yet. `TrackablePanel`'s Save button is simply `disabled` when
  the form is invalid (`canSubmit`), so an invalid form can't even be
  tapped — there's no inline error state, no shake, nothing that "appears"
  the way `ConnectionToast`/the two modals above do. That surface is Phase
  M4's job ("field-error shake"); wiring a warning haptic to a UI element
  that doesn't exist yet would be backwards. Stated here rather than
  silently skipped.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded): **146/149**, the same 3 pre-existing
  live-DB-drift failures as every prior round — no regressions. This phase
  has no new pure logic to unit-test (haptic wiring only, gated behind a
  cache that was already tested implicitly via the existing feedback
  functions' identical pattern).
- **No device test performed this round** — no physical device connected in
  this session. Haptics are inherently not verifiable any other way (nothing
  visual to screenshot, no log line to grep), so this is stated as a real,
  outstanding gap rather than claimed as done. Recommended check next time
  the phone's connected: tap through a few screens/tabs (LIGHT), Save a
  habit / Redeem a reward / Join a group (MEDIUM), open Insufficient-funds
  and Delete-confirm (WARNING) — confirm each feels distinct and none
  double-fire.
- **Not committed** — same "one commit per phase" convention as every prior
  phase; pending the device check above (or the user's explicit go to
  commit without it, as with M1's honest-limits precedent).

## Phase M3 — Pervasive motion polish

All five items from the plan's M3 scope, landed in one pass.

- **Button/FAB squash-press**, centralized in `HardShadow.tsx` (same "one
  change, not fifty" approach as M2's haptics): a shadowed box springs
  toward its own shadow offset on press-in — translating the content box by
  exactly `(dx, dy)` makes it land precisely on top of the shadow layer
  underneath, reading as the button "sinking into" its hard shadow, the
  classic neobrutalist press — and springs back on release. A shadowless
  box (no shadowColor/offset) just scales to 0.96 instead, since there's no
  shadow to sink into. Needed `Animated.createAnimatedComponent(Pressable)`
  (created once at module scope — a fresh one per render would remount the
  underlying native view and break touch entirely) so the press transform
  can live on the `Pressable` itself. Gated on a new
  `getReduceMotionCached()` — a module-scope cache in `useReduceMotion.ts`,
  checked once at import time rather than via the existing per-instance
  async hook, since `HardShadow` alone mounts 130+ times across the app and
  a `useReduceMotion()` call at each one would fire that many redundant
  native `AccessibilityInfo` bridge calls on every screen.
- **XP-bar fill + coin-counter tween.** New `src/components/AnimatedNumber.tsx`
  — tweens a displayed integer to a new value over 500ms (snaps instantly on
  first mount and under reduce-motion) via a JS-driven `Animated.Value` +
  listener (native-driven animations can't feed a live number back to JS for
  text rendering). Wired into: `LevelBar.tsx`'s XP fill bar (was an instant
  `width: {pct}%` snap, now an `Animated.timing` tween) and its `{intoLevel}`
  number; the Today header's coin badge; the Rewards header's coin badge.
  Profile/Stats screens showing the same balance are left as plain text —
  those are visited separately from the earn/spend moment itself, a
  reasonable scope line rather than sweeping every numeric `Text` in the app.
- **Modal slide-up + scrim fade, with a REAL exit animation** (the plan only
  asked for entrance + fade, but a smooth open into an instant-vanish close
  would have read as broken, so this went a bit further). The hard part:
  5 of the 6 concrete modals are conditionally *mounted* by their parent
  (`{x && <FooModal visible .../>}`) — tapping Cancel/Confirm/Delete
  unmounts the whole tree instantly, there's no `visible: true→false` prop
  transition to animate on. Solved with `ModalExitContext`: `Modal` provides
  an `animateOutThenCall(cb)` function; `ModalButton` (and the scrim's
  tap-to-dismiss) call `requestExit(onPress)` instead of `onPress()`
  directly, so the shared 180ms fade-out plays FIRST and only then invokes
  the real handler that triggers the actual unmount/state-change — entirely
  contained inside `Modal.tsx`'s two exports, with zero changes needed to
  any of the 6 concrete modal components or the screens that use them. Two
  modals (`SignOutConfirmModal`, `StreakFreezeExplainerModal`) instead stay
  always-mounted and toggle a real `visible` boolean — handled by the same
  code path (`closed` state initializes from the current `visible` and
  resets on every `false→true` transition, so a reopened always-mounted
  modal replays its entrance correctly instead of staying stuck closed
  after its first use). Split the scrim into a separate tint layer +
  dismiss-`Pressable` so the scrim's own fade doesn't compound with the
  card's independent entrance opacity.
- **Card-list stagger.** New `src/components/StaggerItem.tsx` — fades +
  rises one child in on *its own* mount, delayed by `index * 60ms` (capped
  at 8 steps so a long list doesn't take forever to finish appearing).
  Wrapping each `TrackableCard` with `key={t.id}` on the `StaggerItem`
  (not the card) means React keeps the same instance across re-renders as
  long as the habit isn't added/removed — so the stagger plays once on
  initial load (or when a habit is newly added) and does NOT replay every
  time toggling one habit's done state re-renders the whole list.
- **Tab cross-fade + screen push/pop**, both made explicit instead of
  implicit. Confirmed via `@react-navigation/bottom-tabs`'s own type defs
  that its default is `animation: "none"` (an instant swap, no transition at
  all) — set `animation: "fade"` + `transitionSpec: { duration: 250 }` in
  `app/(tabs)/_layout.tsx`. For the root `Stack` (`app/_layout.tsx`),
  confirmed the opposite: Android's own "default" push/pop already IS a
  native slide transition, so this was mostly about making that an explicit
  choice (`animation: "slide_from_right"`, documented as Android-only,
  falling back to iOS's own default there) rather than an unstated implicit
  default — **not** a numeric-duration change. Checked
  `@react-navigation/native-stack`'s types directly: `animationDuration` is
  documented as **iOS-only**, and explicitly does not apply to `"default"`
  or Android-specific animations like this one — so Android's push/pop
  timing isn't independently tunable through this API at all. Stated here
  rather than silently claiming a "300ms" that the platform doesn't
  actually expose a knob for.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded): expect the same 146/149 (3
  pre-existing live-DB-drift failures, unrelated) — this phase is entirely
  view/animation/navigation config, no new pure logic to unit-test.
- **No device test performed this round** — no physical device connected in
  this session, same honest gap as M2. All five items are visual/motion —
  screenshots can't capture animation, so the real check is a live device
  pass: complete a habit and confirm the coin badge count-up + XP-bar tween,
  press a button and feel the sink/squash, open then Cancel a modal and
  confirm both the entrance AND the new exit fade play, reload Today and
  watch the card stagger, switch tabs and confirm the cross-fade, push into
  Stats/Cosmetics/a group and confirm the slide — then repeat with Android's
  "Remove animations" on and confirm everything snaps to its final state
  instantly with no crash.
- **Not committed** — same per-phase convention; M2 and M3 are both still
  pending a device pass or the user's go to commit without one.

## Phase M4 — Smaller motion touches

All six items from the plan's M4 scope, landed in one pass. This closes out
the full Motion M2→M4 sequence approved in the roadmap.

- **Field-error shake, `TrackablePanel`.** The Save button was fully
  `disabled` when the form was invalid, so there was nothing to shake —
  tapping a disabled button fires no event at all. Changed the button to
  stay visually dimmed (`primaryBtnDisabled`) but remain tappable
  (`disabled={submitting}` only, dropped `!canSubmit`); `submit()` now
  branches on `canSubmit` itself — shakes the whole panel (a 5-step
  alternating-direction `translateX` sequence via `HardShadow`'s existing
  `animatedStyle` escape hatch) and fires `feedbackWarning()` on an invalid
  tap, or `feedbackMedium()` and proceeds on a valid one. This also
  retroactively fulfills what M2 explicitly deferred: "form validation
  failures" had no UI to hang a warning haptic on at the time; now it does.
- **Empty-state Ember idle bob+blink.** New `src/components/IdleEmber.tsx` —
  wraps `Ember` in a looping vertical bob (`Animated.loop`, sine-eased) and,
  every ~3.2s, briefly swaps `expression` from `"sleepy"` to `"neutral"` for
  ~220ms (a "peek" — the existing `sleepy` art IS closed eyes, so a literal
  blink-while-already-closed would be invisible; peeking open and closing
  again reads as a dormant mascot, not a dead one). Swapped into the Today
  screen's zero-habit empty state in place of the static `<Ember
  expression="sleepy">`. Static under reduce-motion.
- **Cosmetic-equip morph.** New `src/components/EquipPop.tsx` — pops a
  child with a quick scale bounce (1 → 1.15 → 1, two chained springs) the
  moment an `equipped` boolean prop transitions false→true, tracked via a
  ref (same "genuine edge, not just truthy" pattern `TrackableCard`'s
  `prevDone` already established) — not on mount, not on every re-render
  while already equipped. Wrapped around all three `app/cosmetics.tsx`
  sections (avatar-color swatches, title rows, card-skin swatches); moved
  each `key` from the `HardShadow` up to the new wrapper since React needs
  it on the direct child returned from `.map()`.
- **Quest-claim coins-fly**, reusing `Confetti.tsx` from M1 exactly as
  planned — no new burst component needed. `app/quests.tsx` tracks a
  transient `justClaimed: questId | null`, set in `claimMutation`'s
  `onSuccess` (celebrates once the server confirms, not optimistically) and
  cleared after 900ms; the matching quest card conditionally renders
  `<Confetti count={12} .../>` as a child, which fills+centers on that
  card specifically since RN `View`s are `position: "relative"` by default.
  Chips can spill past the card's own edges (no `overflow: "hidden"` on
  quest cards) — accepted as the same "juicy, not clipped" precedent
  `LevelUpOverlay`'s confetti already sets.
- **`FloatingXp` arc-to-bar.** Was a pure vertical float+fade with zero
  horizontal movement. Now both X and Y are driven off one shared linear
  `progress` value but interpolated with mismatched curve shapes — Y
  reaches most of its travel early (`[0, 0.85·dy, dy]`), X stays mostly put
  at first then sweeps late (`[0, 0.15·dx, dx]`) — the mismatch between the
  two axes is what reads as a curved arc instead of a straight line, no
  real physics/bezier path needed. The target is `Dimensions.get("window")
  .width / 2` horizontally and a **fixed approximate** header-area Y (95px)
  — not the LevelBar's real measured position, which would need a
  layout-measurement pipeline (a ref threaded down through the overlay);
  stated as the deliberate scope line for what's meant to be a small touch.
- **Splash timing, tuned toward 1200ms** (was ~700-800ms, per Phase A's own
  device-measured number). Slowed the leg-rise stagger (90→130ms offset,
  260→340ms per leg), slightly slowed the cap spring (friction 4→5, tension
  140→120), and added an explicit 180ms hold before the 220ms fade-out
  (previously the fade's own internal `delay:150` was the only pause) so
  the finished mark registers for a beat rather than starting to fade the
  instant it settles. Approximate by construction — a spring's exact settle
  time isn't analytically predictable, and there's no device this session
  to time it live; stated rather than claimed as an exact 1200ms.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded): expect the same 146/149 (3
  pre-existing live-DB-drift failures, unrelated) — entirely view/animation,
  no new pure logic.
- **No device test performed this round** — same honest gap as M2/M3, no
  physical device connected this session. Every item here is motion/timing,
  so the real check is live: submit an invalid habit form and feel the
  shake + warning haptic (and confirm a VALID submit still saves normally,
  since the button is no longer hard-disabled); sit on a zero-habit Today
  screen and watch Ember bob + peek; equip a cosmetic and watch it pop;
  claim a quest and watch the confetti burst on that specific card; complete
  a habit and watch the XP number curve toward the header instead of
  floating straight up; cold-start the app and time the splash by eye
  against the ~1200ms target. Then re-check all of the above with Android's
  "Remove animations" on.
- **Not committed** — M2, M3, and M4 are all still pending either a device
  pass or the user's explicit go to commit without one. This closes the
  full Motion M2→M4 sequence; per the approved point-2 order, notifications
  is next, unless Phase U's UI/UX list arrives first.

## Phase N — Notification polish

Both required items from the plan; the three "optional" ones explicitly
skipped, per the plan's own wording, not silently dropped.

- **Tap handling → deep-link to the habit.** There was zero
  `addNotificationResponseReceivedListener` anywhere — tapping a reminder
  just opened the app to wherever it happened to be. New
  `useNotificationTapHandler` (`src/features/reminders/useNotificationTap.ts`),
  registered once at the app root (`app/_layout.tsx`, unconditional — a
  no-op listener if nothing was ever scheduled, so it doesn't need to be
  gated on session): recovers the trackable id from the notification's
  `${trackableId}:${slot}` identifier (`schedule.ts`'s own format —
  trackable ids are UUIDs with no colons, so splitting on `":"` and taking
  the first segment is unambiguous), stashes it in a new tiny store
  (`src/features/navigation/reminderTap.ts`, the exact same shape
  `addAction.ts` already established for the raised "+" button), and
  navigates to `/(tabs)` (Today). Today reads and clears that store in a
  plain `useEffect` once its trackable list is loaded, opening the matching
  habit's edit panel — a plain effect rather than `useFocusEffect`, since
  Today is the tab this always navigates TO and might already be focused
  (a focus-only hook wouldn't refire in that case).
- **Moved `useReminderSync`'s mount to the app root.** It lived in
  `app/(tabs)/index.tsx`, so a session that never happened to land on
  Today never resynced its reminders. Moved to a small `ReminderSyncMount`
  component in `app/_layout.tsx`, gated on `session` (`{session &&
  <ReminderSyncMount />}`) so it never fetches trackables or schedules
  anything while signed out — rather than adding an `enabled` option to
  `useTrackablesQuery` itself, which is called unconditionally elsewhere
  and didn't need its signature touched for this.
- **Explicitly skipped, per the plan's own "Optional:" framing**: a
  "Mark done" tray action (a notification category — real scope, its own
  small feature, not a one-liner alongside this), an arbitrary time picker
  beyond the 5 presets, and multiple reminders per habit (the `${id}:${i}`
  identifier scheme already supports it, but the add/edit panel has no UI
  for a second slot yet). None of these are needed for "tapping a reminder
  takes you to the right place" and "reminders stay in sync regardless of
  which tab you land on" — the two things actually named as required.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded): expect the same 146/149 (3
  pre-existing live-DB-drift failures, unrelated) — this phase has no new
  pure logic (`schedule.ts`'s existing test coverage is untouched; the new
  code is a listener + a tiny store + a consuming effect, not something
  with a meaningful red-first unit to write).
- **No device test performed this round** — same honest gap as M2-M4, no
  physical device connected this session, and this phase specifically
  needs one: local notifications, foreground/background transitions, and
  tap-while-backgrounded/killed can't be verified any other way. Real
  check next time the phone's connected: schedule a reminder, background
  the app, tap the notification banner, confirm it lands on Today with the
  right habit's edit panel already open; sign out and confirm no crash/
  fetch-storm from the gated `ReminderSyncMount`; toggle the Reminders
  setting off/on and confirm sync still fires correctly from the root.
- **Not committed** — same per-phase convention; M2 through N are all
  still pending either a device pass or the user's go to commit without
  one. Per the approved point-2 order, quest coherence (Phase Q) is next.

## Phase Q — Quest coherence

This closes the full approved "point 2" sequence (Motion M2→M4 →
notifications → quest backend). `QuestWidget.tsx` no longer ignores the
real weekly quest system — the false "no quest backend" comment was already
corrected earlier this session (Phase-U-adjacent batch); this phase does
the actual rewire that comment deferred.

- **New `featuredQuestStatus`** (`src/features/quests/derived.ts`, TDD'd
  first — 3 new cases confirmed red, then green): picks the ONE quest to
  feature where there's only room for one (the compact widget). An
  unclaimed quest that's already met wins (ready to claim — the most
  exciting state); otherwise the active quest closest to its own goal *by
  fraction* (`progress/goal`, not raw count, so a 3/5 quest and a 40/200
  quest compare fairly). A claimed quest is only ever featured as a
  genuine last resort, if every active quest is claimed. Returns `null`
  only if nothing is active at all — not reachable with today's catalog
  (busy_bee/steady/coin_rush have no window), kept correct rather than
  assumed, same defensive-but-honest precedent as the `stats.tsx` fix
  earlier in this session.
- **Plumbed into `WidgetSnapshot`** (`snapshot.ts`, 2 new TDD cases):
  `buildWidgetSnapshot` gained a `questClaims` parameter (defaulting to
  `[]`, same pattern `displayName` already established, so no existing
  call site needed updating) and a new `featuredQuest` field —
  `{title, emoji, progress, goal, reward, met, claimed} | null`, title/
  emoji sourced from the existing `questCopy()` so the widget can't drift
  from the real quests screen's own copy.
- **`QuestWidget.tsx` rewired** to render `snapshot.featuredQuest` instead
  of the `doneToday`/`totalDue` stand-in — real title/emoji/progress bar/
  reward, with the claim-badge text switching between `+{reward} 🪙` (in
  progress), `CLAIM! 🪙{reward}` (met, unclaimed), and `CLAIMED ✓`. The
  header text changed from the mock's literal "QUEST OF THE DAY" to
  "WEEKLY QUEST" — deliberately not verbatim, since the underlying data is
  now a real WEEKLY quest and the mock's daily framing would state
  something false about it, the same call already made for the
  streak-freeze modal's copy earlier this session. Still read-only —
  claiming happens in the app (`app/quests.tsx`), not from the widget.
- **`useWidgetSync.tsx`** gained a `useQuestClaimsQuery()` call, passing
  `questClaims ?? []` through — same shape as the existing
  `useProfileQuery()` → `displayName` wiring.
- **Noted for later, not this phase** (per the plan's own framing): the
  quest catalog is build-time-generated (`QUESTS` → `constants.sql` via
  `gen-sql-constants.ts`), so rotating a quest needs a code change +
  `db:gen-sql` + `db:apply-sql` + a release — moving it into a `quest_defs`
  table would be the real fix, but that's a deliberate scope call from
  earlier this session, not a bug introduced or fixed here.

### Verification
- `npx tsc --noEmit` clean.
- `npx vitest run` (CI=1, backgrounded): 3 new `quests/derived.test.ts`
  cases + 2 new `widget/snapshot.test.ts` cases, all TDD'd red-first then
  green; expect the full suite at 151/154 (146 prior + 5 new, same 3
  pre-existing live-DB-drift failures, unrelated).
- **No device test performed this round** — same honest gap as every
  phase since M2, no physical device connected this session. The widget
  specifically needs one: Combo/Quest widgets were added to the home
  screen in an earlier round, so a real device check would confirm the
  Quest widget now shows a real weekly quest (title/progress/reward)
  instead of the old daily due-count, in both light and dark.
- **Not committed** — same per-phase convention. This closes the full
  approved point-2 sequence end to end. Point 3 (deeper social, richer
  insight, monetization) stays parked for hard launch per the original
  roadmap decision; Phase U (UI/UX fixes) remains blocked on the user's
  own list, not yet provided.

## Device pass — covering the whole accumulated batch (Phase-U-adjacent + M2–M4 + N + Q)

Killed a stale Metro instance left running from earlier in the session (7+
hours old, predating all of this batch) and started fresh with `--clear`,
confirming a genuinely new bundle (3631 modules) rather than trusting
hot-reload — the established caution from every prior device round.

**Real, new constraint hit this round**: this device's shell can no longer
inject synthetic input at all — `adb shell input keyevent/tap` now fails
outright with `SecurityException: ... requires ... INJECT_EVENTS
permission`, confirmed directly rather than assumed. Previous rounds this
session used `adb shell input` for exactly this and it worked; something
about this device/session's permission state has changed. Worked around
where possible: `am start`/`monkey -c LAUNCHER` (Activity Manager
operations, not input injection) still work fine for force-stop/relaunch
and for deep-linking via the app's `habiteer://` scheme — confirmed
`app.config.ts` already declares it. Used those to drive as much of the
pass as could be automated:

- Force-stopped + relaunched the app (`monkey -c LAUNCHER`) — cold boot,
  clean landing on Today, no crash.
- Deep-linked (`am start -a VIEW -d "habiteer:///<route>"`) to `/quests`,
  `/stats`, `/cosmetics`, `/profile` — every one rendered correctly with
  real data, no crash, confirmed via `adb logcat` (zero fatal/
  AndroidRuntime/JS-exception lines across the entire pass):
  - **Today**: 3/3 done, LevelBar showing "220 / 246 XP" (the new
    `AnimatedNumber`-backed text renders correctly at rest), coin badge,
    DONE!/RESISTED! stamps on the reduce-framing habit — all correct final
    states (motion itself can't be confirmed from a still frame, see below).
  - **Quests**: real live data matching `featuredQuestStatus`'s intended
    behavior exactly — Busy Bee 15/15 unclaimed ("Claim +40"), Steady 4/5
    in progress, Coin Rush 200/200 already claimed ("Claimed ✓") — this is
    the same data Phase Q's widget rewire now reads from, so seeing it
    correct here is real (if indirect) confirmation the underlying quest
    logic is sound.
  - **Cosmetics**: all three `EquipPop`-wrapped sections (avatar color,
    title, card skin) render their locked/equipped states correctly.
  - **Profile**: stats grid, Settings toggles (Sound/Haptics/Reminders all
    on, matching the real wiring corrected in the Phase-U-adjacent
    comment fix), no stale "stub" language.
  - **Stats**: coin bar chart + per-habit list at 100% each — confirms the
    `?? "week"` period-fallback fix didn't regress normal day-period habit
    rendering.
- Tried to reach the home screen to check the actual Quest/Combo **widgets**
  (not just the in-app quests screen) — blocked: with input injection
  dead, there's no way to swipe between launcher pages, and the one page
  reachable via the HOME intent didn't have them. **Not verified this
  round** — genuinely open whether the widget renders correctly, not
  simulated as passing.

### What this pass could NOT verify, stated plainly rather than assumed fine
- **Every interactive motion/haptic piece** — button squash/sink-press,
  Modal's real enter+exit animation, `TrackablePanel`'s field-error shake,
  `EquipPop`'s pop-on-equip trigger, quest-claim confetti, tab cross-fade,
  screen push/pop, and all haptics — every one of these requires an actual
  tap to trigger, which this device's shell can no longer perform at all.
  A screenshot only ever catches a rest frame; motion and touch feedback
  aren't just hard to catch mid-frame here, they're structurally
  untriggerable by this session right now.
- **`IdleEmber`'s bob+peek loop** — the empty state it lives in didn't
  render (there are 3 real habits on this account), and reaching it would
  need archiving them all, which needs taps.
- **The notification tap-handler** — needs either a real scheduled
  reminder firing or a manually-constructed test notification; not set up
  this round.
- **The home-screen Quest/Combo widgets themselves**, per above.

This is a real, if partial, verification pass — crash-free across five
screens with a genuinely fresh bundle is worth something, but it is NOT
equivalent to a full interactive check. Flagged honestly rather than
rounded up to "device-verified," matching this project's standing
convention.

---

## Phase P — the staked pledge (server + client complete; device pass outstanding)

### Why this phase exists
You said the long-horizon goals were "basic and not intuitive, doesn't
connect to the player." That was correct, and the cause was my own Phase R
plan, which explicitly scoped out any reward: *"no bonus reward for meeting a
goal — it stays a read-only lens, not a new payout surface."* Defensible
engineering, but it left a progress report sitting inside a game. A goal
became the only thing in the app you never *did* anything with. You picked
the staked-pledge direction and chose to build the earned title properly with
a real grant table.

Planning it surfaced three live vulnerabilities unrelated to pledges, which
became **Phase S** and shipped first (see its own section) — staking coins on
a currency anyone could mint would have been theatre.

### The mechanic
Stake coins to commit. Four checkpoints pay the stake back in pieces as you
progress; finishing returns the whole stake plus a 50% bonus and grants the
`marathoner` title. Missing the window forfeits only what you never banked.

That last rule is the one that matters. `fn_settle_goal` and
`fn_abandon_pledge` both bank every EARNED checkpoint *before* forfeiting the
remainder — otherwise someone who hit 20/20 and never tapped Bank would lose
the whole stake at midnight, which would be us keeping money they
demonstrably earned. There is a test asserting exactly that split (4/8 done,
window closed → 20 paid, 20 forfeited).

### Server
Four RPCs in `rpc.sql`, all `security definer`, all opening with
`perform 1 from profiles where id = auth.uid() for update`, all checking
`user_id = auth.uid()` explicitly (definer means RLS no longer filters them,
so that check is the entire privilege boundary):
`fn_create_pledge`, `fn_bank_goal_checkpoint`, `fn_settle_goal`,
`fn_abandon_pledge`. New ledger kinds: `pledge`, `pledge_return`,
`pledge_bonus`, `pledge_forfeit`.

Details that were easy to get wrong and are deliberately not:
- **Payouts are cumulative** — `total(n) - total(banked)` — so banking three
  checkpoints at once can't drift from banking them one at a time, and the
  four payouts sum to exactly the stake for any integer (50 → 12/12/12/14,
  11 → 2/2/2/5). Tested across a range of stakes.
- **`ceil(target * i / 4.0)`, not `/ 4`** in SQL. Integer division truncates
  *before* `ceil` runs, making `ceil` a no-op — target 10 would give
  thresholds 2,5,7,10 instead of `Math.ceil`'s 3,5,8,10, i.e. the server
  paying a checkpoint one completion earlier than the UI promised.
- **`GOAL_TARGET_MIN = 8` is a coin printer guard, not ergonomics.** At
  target 1 all four thresholds are 1, so one completion would return the
  entire stake plus bonus, repeatable daily.
- **The `goals` EXCLUDE constraint is now partial** —
  `WHERE (state = 'active')` — so terminal pledges are retained as
  settlement records without blocking a new pledge on the same habit.
- **Forfeits write a `delta = 0` ledger row.** Accounting-wise unnecessary
  (the stake left at creation), but without it the original `-50` is
  unexplainable from the append-only ledger alone.
- **The title is gated on `staked_coins >= GOAL_STAKE_MIN`**, so a legacy
  zero-stake goals row can't mint `marathoner` for free.

### The concurrency guard is the load-bearing one
Without the row lock, two rapid Bank taps both read `checkpoints_banked = 0`
and both insert a `pledge_return`. The test fires two simultaneous calls and
asserts exactly one succeeds and the balance moves once — it reads 2 and
double-pays without the lock. Same class of bug the Phase S audit found
already live in `fn_redeem_reward`.

### Client
- `goals/api.ts` rewritten to call the RPCs; the raw insert/delete is gone.
  `deleteGoal` is **deliberately deleted** rather than kept — deleting a
  staked pledge would be a full refund, i.e. a free undo of the commitment.
- Every pledge mutation invalidates `["coinBalance"]` and `["profile"]`
  alongside `["goals"]`, or the coin HUD and the newly-granted title go
  stale until a cold start.
- `GoalPanel` gained a stake stepper and shows the **checkpoint ladder
  before you stake** — asking someone to put coins at risk without showing
  exactly how they come back is how a commitment mechanic reads as a
  punishment mechanic.
- New `PledgeRow` on Stats: threshold dots (earned/banked), progress + pace,
  coins at risk, and a Bank / Collect / Give up action. Settlement is offered
  as an explicit tap, not fired on render — a silent coin movement on
  screen-open makes an economy feel arbitrary.
- Today's card chip is `🤝 n/m`, turning **jade with a 🪙** when a checkpoint
  is bankable, plus a header line ("Ember is holding 🪙 N on your pledge").
  A commitment you can't see isn't doing its job.
- The cosmetics picker now reads `title_grants`: `marathoner`'s sentinel
  unlock level is 9999, so the level comparison alone would have rendered
  "LVL 9999", which reads as a bug rather than a rule. It says
  "KEEP A PLEDGE".

### Edge case closed with a real constraint, not a UI guard
**Archiving a habit mid-pledge would strand the stake** —
`fn_complete_trackable` raises on an archived habit, so no further progress
and no checkpoint would ever be reachable. Blocked in the `trackables` RLS
WITH CHECK (`archived_at is null or not exists (active goal)`), TDD'd
red-first, with the `42501` translated in `archiveTrackable` into "This habit
has a live pledge on it. Settle or give up the pledge first."

### Verification
- `npx tsc --noEmit` clean. Full suite **207/210** — the 3 failures are the
  same long-standing live-account drift (freeze-token XP baseline, test
  account past level 5), unchanged from before this phase.
- New coverage: 6 `pledgeView` cases (pure), 12 pledge RPC integration tests
  including the two-simultaneous-Bank race and the cross-user rejection of
  all three acting RPCs, and 3 archive-block cases.
- After `db:apply-sql`: RLS confirmed **ON for all 13 tables**, 15 policies,
  and every money-carrying table (`coin_ledger`, `completions`,
  `freeze_tokens`, `goals`, `league_standings`, `quest_claims`,
  `title_grants`) confirmed **SELECT-only**.

### Process notes, stated rather than glossed
- **The RPC tests were written after the RPCs, not red-first.** The SQL was
  already applied when this step began, so red wasn't reachable for them.
  The `pledgeView` and archive-block tests *were* confirmed red first. The
  concurrency assertion is still a real proof — it reads 2 without the lock.
- **Test helpers had to grow** because Phase S closed `goals` and
  `coin_ledger` to clients: a test can neither seed a mid-flight pledge nor
  clean up after one as itself. `seedPledge`/`cleanupPledges`/`getPledge` go
  through the admin `pg` connection. `fundCoins` deliberately earns coins
  through `fn_complete_trackable` rather than inserting ledger rows — faking
  the balance would skip the very path a staking test wants funded through.
- **No device pass yet** — no device was attached at the end of this phase.
  Everything above is `tsc` + vitest + live-DB verified; nothing about how
  the pledge panel, ladder, Bank button, or header line actually *look and
  behave on the phone* has been confirmed. Outstanding, not assumed fine.
