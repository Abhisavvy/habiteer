-- Enable RLS and restrict all user data to its owner.
alter table trackables  enable row level security;
alter table completions enable row level security;
alter table coin_ledger enable row level security;
alter table rewards     enable row level security;
alter table profiles      enable row level security;
alter table freeze_tokens enable row level security;

drop policy if exists "own trackables"    on trackables;
drop policy if exists "own completions"   on completions;
drop policy if exists "own ledger"        on coin_ledger;
drop policy if exists "own rewards"       on rewards;
drop policy if exists "own profile"       on profiles;
drop policy if exists "own freeze tokens" on freeze_tokens;

create policy "own trackables"    on trackables    for all using (user_id = auth.uid());
create policy "own completions"   on completions   for all using (user_id = auth.uid());
create policy "own ledger"        on coin_ledger   for all using (user_id = auth.uid());
create policy "own rewards"       on rewards       for all using (user_id = auth.uid());
create policy "own profile"       on profiles      for all using (id = auth.uid());
create policy "own freeze tokens" on freeze_tokens for all using (user_id = auth.uid());

-- A new auth.users row must get a matching profiles row, or every insert into
-- trackables/rewards/etc for that user fails their FK constraint. Without this,
-- signing up leaves a user unable to create anything (found while testing the
-- Phase 2 RPCs — every trackable insert failed FK on "profiles").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (new.id, split_part(new.email, '@', 1), '')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time backfill for any auth users created before this trigger existed.
insert into public.profiles (id, display_name, avatar)
select id, split_part(email, '@', 1), ''
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Leaderboard: a SECURITY DEFINER view exposing only safe, aggregated columns.
-- CREATE OR REPLACE VIEW requires existing columns keep their order; new ones
-- (avatar_color, title_id) are appended at the end. Safe under group by p.id
-- since p.id is the profiles PK (all p.* are functionally dependent).
create or replace view weekly_leaderboard as
  select p.id, p.display_name, p.avatar,
         coalesce(sum(c.xp_earned), 0) as weekly_xp,
         p.avatar_color, p.title_id
  from profiles p
  left join completions c
    on c.user_id = p.id and c.completed_on >= date_trunc('week', now())
  group by p.id
  order by weekly_xp desc;

-- v2 Phase 2: groups + shared rewards + contributions (PLAN.md §5, §9).

alter table groups enable row level security;
alter table group_members enable row level security;
alter table reward_contributions enable row level security;

-- Shared by the "level 3+ to create a group / shared reward" gate (PLAN.md
-- §9) so that literal threshold isn't hand-copied into two policies.
create or replace function public.caller_level()
returns int
language sql
stable
set search_path = public, pg_catalog
as $$
  select level from level_info(
    (select coalesce(sum(xp_earned), 0)::int from completions where user_id = auth.uid())
  );
$$;

-- A group_members policy can't subquery group_members itself in its own
-- USING clause — Postgres re-evaluates that policy for the subquery and
-- recurses forever ("infinite recursion detected in policy"). Routing the
-- lookup through a SECURITY DEFINER function breaks the cycle: it runs as
-- the function owner, which (absent FORCE ROW LEVEL SECURITY, unset here)
-- bypasses RLS for its own internal query instead of re-entering this policy.
create or replace function public.my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

drop policy if exists "member groups"          on groups;
drop policy if exists "create groups at level 3" on groups;
drop policy if exists "member group_members"   on group_members;
drop policy if exists "own rewards"             on rewards;
drop policy if exists "own or group rewards"    on rewards;
drop policy if exists "group reward_contributions select" on reward_contributions;
drop policy if exists "own contribution insert" on reward_contributions;

-- `or created_by = auth.uid()` matters at the exact moment of creation:
-- INSERT ... RETURNING (supabase-js's .insert().select()) checks this SELECT
-- policy against the new row within the SAME statement that fires the
-- on_group_created trigger below — too early to see the trigger's own
-- group_members insert. Without this clause a creator can't see the group
-- they just made. Membership (via the trigger) still governs everything
-- else scoped by my_group_ids() — rewards, contributions, re-fetching later.
create policy "member groups" on groups for select
  using (id in (select public.my_group_ids()) or created_by = auth.uid());

-- Joining a group by invite code goes through fn_join_group (SECURITY
-- DEFINER) instead — a non-member can't SELECT the group to find it
-- otherwise. No UPDATE/DELETE policy either; out of scope for this pass.
create policy "create groups at level 3" on groups for insert
  with check (created_by = auth.uid() and caller_level() >= 3);

-- INSERT ... RETURNING (what supabase-js's .insert().select() sends) also
-- requires the row to satisfy the SELECT policy, not just WITH CHECK — and
-- "member groups" only matches existing group_members rows. Without this,
-- a group's own creator can't see the group they just created. A second,
-- equally narrow SECURITY DEFINER exception (same justification as
-- fn_join_group): group_members has no INSERT policy for `authenticated` at
-- all, so a plain trigger would itself be blocked by RLS.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into group_members (group_id, user_id) values (new.id, new.created_by)
    on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on groups;
create trigger on_group_created
  after insert on groups
  for each row execute function public.handle_new_group();

create policy "member group_members" on group_members for select
  using (group_id in (select public.my_group_ids()));

-- Deliberately no INSERT policy on group_members for `authenticated` — the
-- only path in is fn_join_group, which bypasses RLS as SECURITY DEFINER.

-- Replaces the Phase 1 "own rewards" policy: personal rewards work exactly
-- as before, and shared rewards (user_id is null, group_id set) are visible
-- to / editable by any member of that group, matching PLAN.md §8's "members
-- contribute -> pool fills" model (no creator-only distinction).
create policy "own or group rewards" on rewards for all
  using (
    user_id = auth.uid()
    or group_id in (select public.my_group_ids())
  )
  with check (
    (user_id = auth.uid() and kind = 'personal')
    or (
      kind = 'shared' and user_id is null
      and group_id in (select public.my_group_ids())
      and caller_level() >= 3
    )
  );

create policy "group reward_contributions select" on reward_contributions for select
  using (
    reward_id in (
      select id from rewards where group_id in (select public.my_group_ids())
    )
  );

create policy "own contribution insert" on reward_contributions for insert
  with check (
    user_id = auth.uid()
    and reward_id in (
      select id from rewards where group_id in (select public.my_group_ids())
    )
  );

-- v2 Phase 3: week/month quota recurrence (PLAN.md §7, §9).

drop policy if exists "own trackables" on trackables;

-- Replaces the Phase 1 "own trackables" policy (which had no WITH CHECK at
-- all). A plain edit to an existing day/weekday habit is untouched — period
-- stays 'day' — so only creating or converting a habit *into* week/month
-- recurrence needs level 5, per PLAN.md §9's "Lv 5 ... advanced recurrence".
create policy "own trackables" on trackables for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (period is distinct from 'week' and period is distinct from 'month' or caller_level() >= 5)
  );

-- v2 Phase 10: league tiers (PLAN.md §7, §9, §13 item 10).

alter table league_standings enable row level security;

drop policy if exists "own league standings" on league_standings;
create policy "own league standings" on league_standings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- v3 Gap #3: quest claims are per-user; the reward crediting is done by the
-- security-definer fn_claim_quest, so this policy just scopes reads/writes to
-- the owner (the client only ever SELECTs its own claim history).
alter table quest_claims enable row level security;

drop policy if exists "own quest claims" on quest_claims;
create policy "own quest claims" on quest_claims for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- v2 Phase 11: cosmetics (PLAN.md §9 milestone cosmetics, §13 item 11).
--
-- Replaces the Phase 1 "own profile" policy (which had no WITH CHECK, so a
-- client could set any avatar_color/title_id directly via PostgREST). The
-- gate is enforced HERE, not in an RPC — an RPC would be bypassable while the
-- table stayed open, exactly the mistake the trackables level-5 gate avoids
-- by living in RLS. Levels never decrease (PLAN.md §7), and defaults are
-- level-1 (violet/novice), so a display-name-only update — which re-validates
-- the row's unchanged cosmetic values — always still passes. Unknown ids map
-- to unlock level 9999 (constants.sql), so a tampered id fails the same gate.
-- Placed at the end of this file so caller_level() and the *_unlock_level
-- functions (constants.sql, applied first) already exist.
drop policy if exists "own profile" on profiles;

create policy "own profile" on profiles for all
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and caller_level() >= avatar_color_unlock_level(avatar_color)
    and caller_level() >= title_unlock_level(title_id)
    and caller_level() >= card_skin_unlock_level(card_skin)
  );
