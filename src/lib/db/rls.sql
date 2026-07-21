-- Enable RLS and restrict all user data to its owner.
alter table trackables  enable row level security;
alter table completions enable row level security;
alter table coin_ledger enable row level security;
alter table rewards     enable row level security;
alter table profiles    enable row level security;

drop policy if exists "own trackables"  on trackables;
drop policy if exists "own completions" on completions;
drop policy if exists "own ledger"      on coin_ledger;
drop policy if exists "own rewards"     on rewards;
drop policy if exists "own profile"     on profiles;

create policy "own trackables"  on trackables  for all using (user_id = auth.uid());
create policy "own completions" on completions for all using (user_id = auth.uid());
create policy "own ledger"      on coin_ledger for all using (user_id = auth.uid());
create policy "own rewards"     on rewards     for all using (user_id = auth.uid());
create policy "own profile"     on profiles    for all using (id = auth.uid());

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
create or replace view weekly_leaderboard as
  select p.id, p.display_name, p.avatar,
         coalesce(sum(c.xp_earned), 0) as weekly_xp
  from profiles p
  left join completions c
    on c.user_id = p.id and c.completed_on >= date_trunc('week', now())
  group by p.id
  order by weekly_xp desc;
