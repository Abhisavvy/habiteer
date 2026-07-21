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
  v_xp          int;
  v_coins       int;
begin
  select * into v_trackable from trackables where id = p_id; -- RLS-filtered
  if not found then
    raise exception 'trackable not found';
  end if;

  -- Idempotency check runs BEFORE the archived-at guard: completing a task
  -- archives it in the same write, so a same-day retry must replay the
  -- cached result, not fail with "trackable is archived".
  select * into v_existing from completions
    where trackable_id = p_id and completed_on = current_app_date();
  if found then
    return jsonb_build_object(
      'xp', v_existing.xp_earned,
      'coins', v_existing.coins_earned,
      'streak_after', v_existing.streak_after,
      'level', to_jsonb((select li from level_info(
        (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
      ) li))
    );
  end if;

  if v_trackable.archived_at is not null then
    raise exception 'trackable is archived';
  end if;

  if v_trackable.kind = 'habit' then
    -- Streak walk mirrors src/features/gamification/streak.ts's currentStreak:
    -- today counts as done without a prior insert, so the TS lib's "grace"
    -- branch (for projecting streak before today is marked done) never applies.
    v_cursor := current_app_date();
    v_streak := 0;
    for i in 0 .. 3999 loop -- mirrors streak.ts's MAX_LOOKBACK
      v_is_scheduled := v_trackable.weekdays is null
                         or array_length(v_trackable.weekdays, 1) is null
                         or extract(dow from v_cursor)::int = any(v_trackable.weekdays);
      if v_is_scheduled then
        v_is_done := (v_cursor = current_app_date())
                      or exists(select 1 from completions
                                where trackable_id = p_id and completed_on = v_cursor);
        if v_is_done then
          v_streak := v_streak + 1;
        else
          exit;
        end if;
      end if;
      v_cursor := v_cursor - 1;
    end loop;

    v_xp := round(difficulty_base(v_trackable.difficulty) * combo_multiplier(v_streak));
    v_coins := v_trackable.coin_value; -- flat, editable per habit
  else -- task
    v_xp := 0;
    v_streak := 0;
    v_coins := task_coins(v_trackable.difficulty); -- always derived fresh from difficulty
  end if;

  begin
    insert into completions (trackable_id, user_id, completed_on, xp_earned, coins_earned, streak_after)
      values (p_id, auth.uid(), current_app_date(), v_xp, v_coins, v_streak)
      returning id into v_completion_id;
  exception when unique_violation then
    -- Lost a race with a concurrent identical call; replay the idempotent result.
    select * into v_existing from completions
      where trackable_id = p_id and completed_on = current_app_date();
    return jsonb_build_object(
      'xp', v_existing.xp_earned,
      'coins', v_existing.coins_earned,
      'streak_after', v_existing.streak_after,
      'level', to_jsonb((select li from level_info(
        (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
      ) li))
    );
  end;

  insert into coin_ledger (user_id, delta, kind, ref_id)
    values (auth.uid(), v_coins, 'earn', v_completion_id);

  if v_trackable.kind = 'task' then
    update trackables set archived_at = now() where id = p_id;
  end if;

  return jsonb_build_object(
    'xp', v_xp,
    'coins', v_coins,
    'streak_after', v_streak,
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

  if v_trackable.kind = 'task' then
    update trackables set archived_at = null where id = p_id; -- symmetric with complete's archive
  end if;

  return jsonb_build_object(
    'xp', -v_completion.xp_earned,
    'coins', -v_completion.coins_earned,
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
  -- RLS already excludes shared/group rewards (user_id is null on those, and
  -- the policy is `user_id = auth.uid()`), so no explicit kind check needed.
  select * into v_reward from rewards where id = p_id;
  if not found then
    raise exception 'reward not found';
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

grant execute on function public.fn_complete_trackable(uuid) to authenticated;
grant execute on function public.fn_undo_completion(uuid) to authenticated;
grant execute on function public.fn_redeem_reward(uuid) to authenticated;
