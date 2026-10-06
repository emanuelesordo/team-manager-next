-- Historical club form used as the early-season prior for projections.
create table if not exists public.app_club_season_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  opponent_id uuid references public.app_opponents(id) on delete cascade,
  season_start_year smallint not null check (season_start_year between 2000 and 2100),
  tier_level numeric(6,3) not null check (tier_level > 0 and tier_level <= 999),
  final_position smallint not null check (final_position > 0 and final_position <= 100),
  points integer not null check (points >= 0),
  max_points integer not null check (max_points > 0 and points <= max_points),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_club_season_history_one_club_chk
    check ((team_id is not null) <> (opponent_id is not null))
);

create unique index if not exists app_club_season_history_team_season_uq
  on public.app_club_season_history(team_id, season_start_year)
  where team_id is not null;

create unique index if not exists app_club_season_history_opponent_season_uq
  on public.app_club_season_history(opponent_id, season_start_year)
  where opponent_id is not null;

create index if not exists app_club_season_history_year_idx
  on public.app_club_season_history(season_start_year desc);

alter table public.app_club_season_history enable row level security;

create policy "app_club_season_history_read"
on public.app_club_season_history for select
to anon, authenticated
using (true);

create policy "app_club_season_history_staff_insert"
on public.app_club_season_history for insert
to authenticated
with check ((select private.is_staff()));

create policy "app_club_season_history_staff_update"
on public.app_club_season_history for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "app_club_season_history_staff_delete"
on public.app_club_season_history for delete
to authenticated
using ((select private.is_staff()));

grant select on table public.app_club_season_history to anon;
grant select, insert, update, delete on table public.app_club_season_history to authenticated;
grant select, insert, update, delete on table public.app_club_season_history to service_role;
