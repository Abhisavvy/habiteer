-- Enable RLS and restrict all user data to its owner.
alter table trackables  enable row level security;
alter table completions enable row level security;
alter table coin_ledger enable row level security;
alter table rewards     enable row level security;

create policy "own trackables"  on trackables  for all using (user_id = auth.uid());
create policy "own completions" on completions for all using (user_id = auth.uid());
create policy "own ledger"      on coin_ledger for all using (user_id = auth.uid());
create policy "own rewards"     on rewards     for all using (user_id = auth.uid());

-- Leaderboard: a SECURITY DEFINER view exposing only safe, aggregated columns.
create or replace view weekly_leaderboard as
  select p.id, p.display_name, p.avatar,
         coalesce(sum(c.xp_earned), 0) as weekly_xp
  from profiles p
  left join completions c
    on c.user_id = p.id and c.completed_on >= date_trunc('week', now())
  group by p.id
  order by weekly_xp desc;
