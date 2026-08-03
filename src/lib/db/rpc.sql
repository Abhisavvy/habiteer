-- Phase 2 server-authoritative mutations. Depends on generated/constants.sql
-- having been applied first (difficulty_base, combo_multiplier, task_coins,
-- level_info). Run via `npm run db:apply-sql`.

-- "Today" is always decided server-side, in UTC, matching the gamification
-- lib's UTC-anchored ISODate convention (src/features/gamification/dates.ts).
-- Never trust a client-supplied date here — that would let a client fake streaks.
create or replace function public.current_app_date()
returns date
language sql
stable
set search_path = public, pg_catalog
as $$
  select (now() at time zone 'utc')::date;
$$;

-- No CHECK constraint existed on coin_ledger.kind at all (schema.ts only
-- documents the allowed values in a comment) — adding one now, including
-- 'undo' for fn_undo_completion's compensating ledger entries.
alter table coin_ledger drop constraint if exists coin_ledger_kind_check;
alter table coin_ledger add constraint coin_ledger_kind_check
  check (kind in ('earn', 'redeem', 'contribute', 'undo', 'quest'));

create index if not exists completions_user_date_idx on completions (user_id, completed_on);

-- v2 Phase 3: week/month quota recurrence (PLAN.md §7). Mirror of
-- src/features/gamification/dates.ts's weekStart/monthStart/prevPeriodStart —
-- date_trunc('week', ...) is Postgres's own Monday-start ISO week, matching
-- the TS lib's convention exactly.
create or replace function public.period_end(p_start date, p_period text)
returns date
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case p_period
    when 'week' then p_start + 7
    when 'month' then (p_start + interval '1 month')::date
  end;
$$;

create or replace function public.prev_period_start(p_start date, p_period text)
returns date
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case p_period
    when 'week' then p_start - 7
    when 'month' then (p_start - interval '1 month')::date
  end;
$$;

create or replace function public.fn_complete_trackable(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_trackable   trackables;
  v_existing    completions;
  v_completion_id uuid;
  v_cursor      date;
  v_streak      int;
  v_is_scheduled boolean;
  v_is_done     boolean;
  v_period_start date;
  v_count_in_period int;
  v_xp          int;
  v_coins       int;
  v_freeze_balance  int;
  v_freeze_spent    int := 0;
  v_freeze_granted  int := 0;
  v_total_xp_before int;
  v_level_before    int;
  v_level_after     int;
begin
  -- Serialises this user's coin-moving RPCs against each other. Without it,
  -- two concurrent calls can both pass a balance check on the same funds
  -- (read-committed lets both read the pre-debit total). Every coin-moving
  -- function in this file takes this same lock first, so they queue per-user.
  perform 1 from profiles where id = auth.uid() for update;

  -- Ownership is checked EXPLICITLY, not via RLS: this function is security
  -- definer (it must be, since the client can no longer write completions or
  -- coin_ledger itself), so RLS no longer filters these reads for us.
  select * into v_trackable from trackables where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'trackable not found';
  end if;

  -- Guarantees a row exists so every read below can be a plain SELECT.
  insert into freeze_tokens (user_id, balance) values (auth.uid(), 0) on conflict (user_id) do nothing;

  -- Idempotency check runs BEFORE the archived-at guard: completing a task
  -- archives it in the same write, so a same-day retry must replay the
  -- cached result, not fail with "trackable is archived".
  select * into v_existing from completions
    where trackable_id = p_id and user_id = auth.uid() and completed_on = current_app_date();
  if found then
    select balance into v_freeze_balance from freeze_tokens where user_id = auth.uid();
    return jsonb_build_object(
      'xp', v_existing.xp_earned,
      'coins', v_existing.coins_earned,
      'streak_after', v_existing.streak_after,
      'freeze_tokens', v_freeze_balance,
      'level', to_jsonb((select li from level_info(
        (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
      ) li))
    );
  end if;

  if v_trackable.archived_at is not null then
    raise exception 'trackable is archived';
  end if;

  v_total_xp_before := (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid());

  if v_trackable.kind = 'habit' then
    select balance into v_freeze_balance from freeze_tokens where user_id = auth.uid();

    if v_trackable.period = 'week' or v_trackable.period = 'month' then
      -- Period-granular walk mirroring streak.ts's currentStreakForPeriod:
      -- a period counts once its completions-so-far reach quota, including
      -- the current still-open one. Freeze-bridges one under-quota PRIOR
      -- (fully elapsed) period, same mechanic as the day-walk below.
      v_period_start := case v_trackable.period
        when 'week' then date_trunc('week', current_app_date())::date
        else date_trunc('month', current_app_date())::date
      end;
      v_streak := 0;

      -- +1 for the completion about to be inserted below (not in the table yet).
      v_count_in_period := 1 + (
        select count(*) from completions
        where trackable_id = p_id
          and completed_on >= v_period_start
          and completed_on < period_end(v_period_start, v_trackable.period)
      );
      if v_count_in_period >= v_trackable.quota then
        v_streak := v_streak + 1;
      end if;
      v_period_start := prev_period_start(v_period_start, v_trackable.period);

      for i in 0 .. 599 loop -- mirrors streak.ts's MAX_LOOKBACK_PERIODS
        exit when v_period_start < v_trackable.created_at::date;
        v_count_in_period := (
          select count(*) from completions
          where trackable_id = p_id
            and completed_on >= v_period_start
            and completed_on < period_end(v_period_start, v_trackable.period)
        );
        if v_count_in_period >= v_trackable.quota then
          v_streak := v_streak + 1;
        elsif v_freeze_balance - v_freeze_spent > 0 then
          v_freeze_spent := v_freeze_spent + 1;
          v_streak := v_streak + 1;
        else
          exit;
        end if;
        v_period_start := prev_period_start(v_period_start, v_trackable.period);
      end loop;
    else
      -- Streak walk mirrors src/features/gamification/streak.ts's currentStreak,
      -- extended with freeze-token bridging: today counts as done without a
      -- prior insert (the TS lib's "grace" branch never applies here), and a
      -- missed scheduled day is bridged — streak continues uninterrupted,
      -- one token spent — if a token is still available.
      v_cursor := current_app_date();
      v_streak := 0;
      for i in 0 .. 3999 loop -- mirrors streak.ts's MAX_LOOKBACK
        -- A day before the trackable existed isn't a missed day — there was
        -- nothing to do. Stop (don't break-vs-bridge a day that was never real).
        exit when v_cursor < v_trackable.created_at::date;
        v_is_scheduled := v_trackable.weekdays is null
                           or array_length(v_trackable.weekdays, 1) is null
                           or extract(dow from v_cursor)::int = any(v_trackable.weekdays);
        if v_is_scheduled then
          v_is_done := (v_cursor = current_app_date())
                        or exists(select 1 from completions
                                  where trackable_id = p_id and completed_on = v_cursor);
          if v_is_done then
            v_streak := v_streak + 1;
          elsif v_freeze_balance - v_freeze_spent > 0 then
            v_freeze_spent := v_freeze_spent + 1;
            v_streak := v_streak + 1;
          else
            exit;
          end if;
        end if;
        v_cursor := v_cursor - 1;
      end loop;
    end if;

    v_xp := round(difficulty_base(v_trackable.difficulty) * combo_multiplier(v_streak));
    v_coins := v_trackable.coin_value; -- flat, editable per habit

    -- Only habits earn XP, so only habits can cross a level boundary.
    v_level_before := (select level from level_info(v_total_xp_before));
    v_level_after := (select level from level_info(v_total_xp_before + v_xp));
    v_freeze_granted := tokens_earned_between_levels(v_level_before, v_level_after);
  else -- task
    v_xp := 0;
    v_streak := 0;
    v_coins := task_coins(v_trackable.difficulty); -- always derived fresh from difficulty
  end if;

  begin
    insert into completions (trackable_id, user_id, completed_on, xp_earned, coins_earned, streak_after, freeze_spent, freeze_granted)
      values (p_id, auth.uid(), current_app_date(), v_xp, v_coins, v_streak, v_freeze_spent, v_freeze_granted)
      returning id into v_completion_id;
  exception when unique_violation then
    -- Lost a race with a concurrent identical call; replay the idempotent result.
    select * into v_existing from completions
      where trackable_id = p_id and completed_on = current_app_date();
    select balance into v_freeze_balance from freeze_tokens where user_id = auth.uid();
    return jsonb_build_object(
      'xp', v_existing.xp_earned,
      'coins', v_existing.coins_earned,
      'streak_after', v_existing.streak_after,
      'freeze_tokens', v_freeze_balance,
      'level', to_jsonb((select li from level_info(
        (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
      ) li))
    );
  end;

  insert into coin_ledger (user_id, delta, kind, ref_id)
    values (auth.uid(), v_coins, 'earn', v_completion_id);

  if v_freeze_spent > 0 or v_freeze_granted > 0 then
    update freeze_tokens
      set balance = greatest(0, least(freeze_token_max_balance(), balance - v_freeze_spent + v_freeze_granted))
      where user_id = auth.uid()
      returning balance into v_freeze_balance;
  else
    select balance into v_freeze_balance from freeze_tokens where user_id = auth.uid();
  end if;

  if v_trackable.kind = 'task' then
    update trackables set archived_at = now() where id = p_id;
  end if;

  return jsonb_build_object(
    'xp', v_xp,
    'coins', v_coins,
    'streak_after', v_streak,
    'freeze_tokens', v_freeze_balance,
    'level', to_jsonb((select li from level_info(
      (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
    ) li))
  );
end;
$$;

create or replace function public.fn_undo_completion(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_trackable  trackables;
  v_completion completions;
  v_freeze_balance int;
begin
  perform 1 from profiles where id = auth.uid() for update; -- see fn_complete_trackable

  -- Explicit ownership: security definer, so RLS no longer filters these.
  select * into v_trackable from trackables where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'trackable not found';
  end if;

  select * into v_completion from completions
    where trackable_id = p_id and user_id = auth.uid() and completed_on = current_app_date();
  if not found then
    raise exception 'no completion today to undo';
  end if;

  -- Compensating ledger row (not a delete of the original 'earn' row) so
  -- coin_ledger stays an append-only audit trail of what actually happened.
  insert into coin_ledger (user_id, delta, kind, ref_id)
    values (auth.uid(), -v_completion.coins_earned, 'undo', v_completion.id);

  delete from completions where id = v_completion.id;

  -- Reverse whatever THIS completion did to the freeze balance: refund any
  -- spent token, revoke any granted one. Stored on the completion row itself
  -- because other completions may have touched the same balance since.
  insert into freeze_tokens (user_id, balance) values (auth.uid(), 0) on conflict (user_id) do nothing;
  update freeze_tokens
    set balance = greatest(0, least(freeze_token_max_balance(),
      balance + v_completion.freeze_spent - v_completion.freeze_granted))
    where user_id = auth.uid()
    returning balance into v_freeze_balance;

  if v_trackable.kind = 'task' then
    update trackables set archived_at = null where id = p_id; -- symmetric with complete's archive
  end if;

  return jsonb_build_object(
    'xp', -v_completion.xp_earned,
    'coins', -v_completion.coins_earned,
    'freeze_tokens', v_freeze_balance,
    'level', to_jsonb((select li from level_info(
      (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
    ) li))
  );
end;
$$;

create or replace function public.fn_redeem_reward(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_reward  rewards;
  v_balance int;
begin
  perform 1 from profiles where id = auth.uid() for update; -- see fn_complete_trackable

  -- Read unfiltered (security definer means RLS no longer scopes this), then
  -- branch explicitly. Ordered so the pre-existing error messages are
  -- preserved: a shared reward still reports 'not a personal reward' rather
  -- than collapsing into 'not found'. The ownership check comes last and
  -- deliberately reuses 'reward not found' so it never leaks whether some
  -- other user's reward id exists.
  select * into v_reward from rewards where id = p_id;
  if not found then
    raise exception 'reward not found';
  end if;
  -- Shared rewards go through fn_contribute_to_reward instead — redeeming
  -- one directly would let a single member "buy" it off their own balance,
  -- bypassing the pooled-contribution model (PLAN.md §8). RLS now lets group
  -- members SELECT shared rewards too, so this can no longer rely on the
  -- old "user_id is null is invisible" side effect to keep them apart.
  if v_reward.kind != 'personal' then
    raise exception 'not a personal reward';
  end if;
  if v_reward.user_id is distinct from auth.uid() then
    raise exception 'reward not found'; -- same message: don't leak existence
  end if;
  if v_reward.completed_at is not null then
    raise exception 'reward already redeemed';
  end if;

  select coalesce(sum(delta), 0) into v_balance from coin_ledger where user_id = auth.uid();
  if v_balance < v_reward.cost then
    raise exception 'insufficient coins';
  end if;

  insert into coin_ledger (user_id, delta, kind, ref_id)
    values (auth.uid(), -v_reward.cost, 'redeem', p_id);
  update rewards set completed_at = now() where id = p_id;

  select coalesce(sum(delta), 0) into v_balance from coin_ledger where user_id = auth.uid();
  return jsonb_build_object('balance', v_balance);
end;
$$;

-- v2 Phase 2: groups + shared rewards (PLAN.md §5, §8, §9).

-- A non-member can't SELECT a group by invite code (RLS restricts that to
-- existing members), so the lookup-and-join has to run as the table owner.
-- The only SECURITY DEFINER function in this codebase — scoped as narrowly
-- as possible: look up by code, no-op if already a member, else insert,
-- return only the group's own public info.
create or replace function public.fn_join_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_group groups;
begin
  select * into v_group from groups where invite_code = p_code;
  if not found then
    raise exception 'invalid invite code';
  end if;

  insert into group_members (group_id, user_id) values (v_group.id, auth.uid())
    on conflict (group_id, user_id) do nothing;

  return jsonb_build_object('id', v_group.id, 'name', v_group.name, 'inviteCode', v_group.invite_code);
end;
$$;

create or replace function public.fn_contribute_to_reward(p_reward_id uuid, p_amount int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_reward             rewards;
  v_balance            int;
  v_total_contributed  int;
begin
  perform 1 from profiles where id = auth.uid() for update; -- see fn_complete_trackable

  -- Security definer, so RLS no longer filters this read. Authorisation for a
  -- SHARED reward is group membership rather than row ownership, and that is
  -- already checked explicitly below — which is now the sole gate, not just a
  -- friendlier duplicate of an RLS rejection.
  select * into v_reward from rewards where id = p_reward_id;
  if not found then
    raise exception 'reward not found';
  end if;
  if v_reward.kind != 'shared' then
    raise exception 'not a shared reward';
  end if;
  if v_reward.completed_at is not null then
    raise exception 'reward already unlocked';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  -- THE authorisation gate for this function (was a friendlier duplicate of an
  -- RLS rejection; since this became security definer, RLS no longer backs it
  -- up, so this check is load-bearing on its own — do not remove).
  if not exists (
    select 1 from group_members where group_id = v_reward.group_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;

  select coalesce(sum(delta), 0) into v_balance from coin_ledger where user_id = auth.uid();
  if v_balance < p_amount then
    raise exception 'insufficient coins';
  end if;

  insert into coin_ledger (user_id, delta, kind, ref_id)
    values (auth.uid(), -p_amount, 'contribute', p_reward_id);
  insert into reward_contributions (reward_id, user_id, amount)
    values (p_reward_id, auth.uid(), p_amount);

  select coalesce(sum(amount), 0) into v_total_contributed
    from reward_contributions where reward_id = p_reward_id;

  if v_total_contributed >= v_reward.cost then
    update rewards set completed_at = now() where id = p_reward_id;
  end if;

  select coalesce(sum(delta), 0) into v_balance from coin_ledger where user_id = auth.uid();

  return jsonb_build_object(
    'contributed', p_amount,
    'totalContributed', v_total_contributed,
    'remainingBalance', v_balance,
    'unlocked', v_total_contributed >= v_reward.cost
  );
end;
$$;

-- v2 Phase 10: league tiers (PLAN.md §7, §9, §13 item 10). Rank-based
-- promotion/relegation on the SAME weekly window weekly_leaderboard already
-- uses (date_trunc('week', ...)) — leagues extend the existing board, not a
-- separate cohort system. No server-side cron exists on this stack (PLAN.md
-- §4's whole framing is "nothing extra to host"), so this is a lazy,
-- idempotent-per-week sync: whichever user opens the Board first after a
-- week boundary settles their own row; everyone else settles on their own
-- next visit. League state is per-user, not a shared snapshot, so there's
-- no coordination problem in that.
create or replace function public.fn_sync_league()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current_week date := date_trunc('week', current_app_date())::date;
  v_last league_standings;
  v_prev_week date;
  v_prev_xp int;
  v_prev_rank int;
  v_active_count int;
  v_tiers text[] := public.league_tiers();
  v_prev_idx int;
  v_new_idx int;
  v_new_tier text;
begin
  select * into v_last from league_standings
    where user_id = auth.uid() order by week desc limit 1;

  -- Already synced for this week — safe no-op, same idempotency shape
  -- fn_complete_trackable already uses for same-day retries.
  if v_last.week = v_current_week then
    return jsonb_build_object('tier', v_last.tier, 'week', v_last.week, 'promoted', false, 'relegated', false);
  end if;

  -- First sync ever: nothing to settle, seed the lowest tier at the current week.
  if v_last is null then
    insert into league_standings (user_id, week, tier, xp) values (auth.uid(), v_current_week, v_tiers[1], 0);
    return jsonb_build_object('tier', v_tiers[1], 'week', v_current_week, 'promoted', false, 'relegated', false);
  end if;

  v_prev_week := v_last.week;

  -- Settle the previously-current week now that it's fully elapsed: backfill
  -- its real total, then decide whether that performance promotes/relegates.
  select coalesce(sum(xp_earned), 0) into v_prev_xp
    from completions
    where user_id = auth.uid() and completed_on >= v_prev_week and completed_on < v_prev_week + 7;

  update league_standings set xp = v_prev_xp where user_id = auth.uid() and week = v_prev_week;

  select count(*) into v_active_count
    from (
      select user_id from completions
      where completed_on >= v_prev_week and completed_on < v_prev_week + 7
      group by user_id
    ) active;

  select count(*) + 1 into v_prev_rank
    from (
      select user_id, sum(xp_earned) as wxp
      from completions
      where completed_on >= v_prev_week and completed_on < v_prev_week + 7
      group by user_id
      having sum(xp_earned) > v_prev_xp
    ) higher;

  v_prev_idx := array_position(v_tiers, v_last.tier);
  v_new_idx := v_prev_idx;

  if v_prev_xp = 0 then
    v_new_idx := greatest(1, v_prev_idx - 1); -- inactive week: automatic relegation
  elsif v_prev_rank <= public.league_promote_top() then
    v_new_idx := least(array_length(v_tiers, 1), v_prev_idx + 1);
  elsif v_prev_rank > greatest(v_active_count - public.league_relegate_bottom(), public.league_relegate_bottom()) then
    v_new_idx := greatest(1, v_prev_idx - 1);
  end if;

  v_new_tier := v_tiers[v_new_idx];
  insert into league_standings (user_id, week, tier, xp) values (auth.uid(), v_current_week, v_new_tier, 0);

  return jsonb_build_object(
    'tier', v_new_tier,
    'week', v_current_week,
    'previousTier', v_last.tier,
    'promoted', v_new_idx > v_prev_idx,
    'relegated', v_new_idx < v_prev_idx
  );
end;
$$;

-- v3 Gap #3: group shared-streak activity feed.
-- Returns the days each member of a group logged >=1 completion since p_since.
-- SECURITY DEFINER so it can read co-members' activity DAYS only (never habit
-- names/details) while RLS keeps `completions` otherwise owner-private; guarded
-- so only a member of the group may call it. Powers the client-side
-- groupStreak()/membersDoneToday() calc — no cron, and because it derives from
-- completions live, undo needs no special handling.
create or replace function public.fn_group_activity(p_group_id uuid, p_since date)
returns table(user_id uuid, day date)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;

  return query
    select distinct c.user_id, c.completed_on as day
    from completions c
    join group_members gm on gm.user_id = c.user_id
    where gm.group_id = p_group_id
      and c.completed_on >= p_since;
end;
$$;

-- v3 Gap #3: claim a weekly quest for a coin reward. Server-authoritative — the
-- metric is recomputed here from THIS ISO week's completions (never trusts the
-- client), the reward/goal/window come from the generated quest_* functions
-- (mirrored from constants.ts), and the (user, quest, week) unique constraint +
-- the explicit already-claimed check make it idempotent (one claim per week).
-- Reward is COINS via a 'quest' coin_ledger entry (never XP).
create or replace function public.fn_claim_quest(p_quest_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_metric   text := quest_metric(p_quest_id);
  v_goal     int  := quest_goal(p_quest_id);
  v_reward   int  := quest_reward(p_quest_id);
  v_from     date := quest_active_from(p_quest_id);
  v_until    date := quest_active_until(p_quest_id);
  v_week     date := date_trunc('week', current_app_date())::date;
  v_progress int;
  v_balance  int;
begin
  if v_metric is null then
    raise exception 'unknown quest';
  end if;
  if (v_from is not null and current_app_date() < v_from)
     or (v_until is not null and current_app_date() > v_until) then
    raise exception 'quest not active';
  end if;
  if exists (select 1 from quest_claims where user_id = auth.uid() and quest_id = p_quest_id and week = v_week) then
    raise exception 'already claimed this week';
  end if;

  v_progress := case v_metric
    when 'completions'  then (select count(*)::int from completions where user_id = auth.uid() and completed_on >= v_week)
    when 'active_days'  then (select count(distinct completed_on)::int from completions where user_id = auth.uid() and completed_on >= v_week)
    when 'coins_earned' then (select coalesce(sum(coins_earned), 0)::int from completions where user_id = auth.uid() and completed_on >= v_week)
    else 0
  end;
  if v_progress < v_goal then
    raise exception 'quest not complete';
  end if;

  insert into quest_claims (user_id, quest_id, week, reward)
    values (auth.uid(), p_quest_id, v_week, v_reward);
  insert into coin_ledger (user_id, delta, kind) values (auth.uid(), v_reward, 'quest');
  select coalesce(sum(delta), 0) into v_balance from coin_ledger where user_id = auth.uid();

  return jsonb_build_object('reward', v_reward, 'balance', v_balance, 'week', v_week);
end;
$$;

grant execute on function public.fn_complete_trackable(uuid) to authenticated;
grant execute on function public.fn_undo_completion(uuid) to authenticated;
grant execute on function public.fn_redeem_reward(uuid) to authenticated;
grant execute on function public.fn_join_group(text) to authenticated;
grant execute on function public.fn_contribute_to_reward(uuid, int) to authenticated;
grant execute on function public.fn_sync_league() to authenticated;
grant execute on function public.fn_group_activity(uuid, date) to authenticated;
grant execute on function public.fn_claim_quest(text) to authenticated;
