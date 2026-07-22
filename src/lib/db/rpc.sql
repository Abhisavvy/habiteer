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
  check (kind in ('earn', 'redeem', 'contribute', 'undo'));

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
  select * into v_trackable from trackables where id = p_id; -- RLS-filtered
  if not found then
    raise exception 'trackable not found';
  end if;

  -- Guarantees a row exists so every read below can be a plain SELECT.
  insert into freeze_tokens (user_id, balance) values (auth.uid(), 0) on conflict (user_id) do nothing;

  -- Idempotency check runs BEFORE the archived-at guard: completing a task
  -- archives it in the same write, so a same-day retry must replay the
  -- cached result, not fail with "trackable is archived".
  select * into v_existing from completions
    where trackable_id = p_id and completed_on = current_app_date();
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
set search_path = public, pg_catalog
as $$
declare
  v_trackable  trackables;
  v_completion completions;
  v_freeze_balance int;
begin
  select * into v_trackable from trackables where id = p_id; -- RLS-filtered
  if not found then
    raise exception 'trackable not found';
  end if;

  select * into v_completion from completions
    where trackable_id = p_id and completed_on = current_app_date();
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
set search_path = public, pg_catalog
as $$
declare
  v_reward  rewards;
  v_balance int;
begin
  select * into v_reward from rewards where id = p_id; -- RLS-filtered
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
set search_path = public, pg_catalog
as $$
declare
  v_reward             rewards;
  v_balance            int;
  v_total_contributed  int;
begin
  select * into v_reward from rewards where id = p_reward_id; -- RLS-filtered
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
  -- Friendly, explicit check rather than letting this fall through to a
  -- raw RLS rejection on the reward_contributions insert below.
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

grant execute on function public.fn_complete_trackable(uuid) to authenticated;
grant execute on function public.fn_undo_completion(uuid) to authenticated;
grant execute on function public.fn_redeem_reward(uuid) to authenticated;
grant execute on function public.fn_join_group(text) to authenticated;
grant execute on function public.fn_contribute_to_reward(uuid, int) to authenticated;
