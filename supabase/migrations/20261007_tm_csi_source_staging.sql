-- CSI Live staging source: provisional snapshots only. No direct writes to app_match_events.
create table if not exists public.app_match_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.app_competition_fixtures(id) on delete cascade,
  match_id uuid references public.app_matches(id) on delete set null,
  source text not null default 'csi' check (source in ('csi')),
  source_url text not null,
  source_match_code text,
  payload_hash text not null,
  fetched_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','reviewing','confirmed','superseded','rejected')),
  home_score smallint,
  away_score smallint,
  raw_payload jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (fixture_id, source, payload_hash)
);
create index if not exists app_match_source_snapshots_fixture_idx on public.app_match_source_snapshots(fixture_id, fetched_at desc);
create index if not exists app_match_source_snapshots_pending_idx on public.app_match_source_snapshots(review_status, fetched_at desc);

create table if not exists public.app_match_source_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.app_match_source_snapshots(id) on delete cascade,
  event_ordinal integer not null check (event_ordinal >= 0),
  period smallint,
  minute smallint,
  stoppage_minute smallint,
  source_team_side text check (source_team_side in ('home','away') or source_team_side is null),
  event_type text not null,
  player_name text,
  shirt_number smallint,
  player_out_name text,
  player_out_number smallint,
  player_in_name text,
  player_in_number smallint,
  score_home smallint,
  score_away smallint,
  raw_payload jsonb not null,
  linked_event_id uuid references public.app_match_events(id) on delete set null,
  match_state text not null default 'unmatched'
    check (match_state in ('unmatched','exact','probable','conflict','tm_only','csi_only','accepted','ignored')),
  match_confidence numeric(5,2),
  review_decision text check (review_decision in ('keep_tm','use_csi','amend','add','ignore') or review_decision is null),
  created_at timestamptz not null default now(),
  unique (snapshot_id, event_ordinal)
);
create index if not exists app_match_source_events_snapshot_idx on public.app_match_source_events(snapshot_id, event_ordinal);

alter table public.app_match_source_snapshots enable row level security;
alter table public.app_match_source_events enable row level security;
revoke all on public.app_match_source_snapshots from public, anon, authenticated;
revoke all on public.app_match_source_events from public, anon, authenticated;
grant select on public.app_match_source_snapshots to authenticated;
grant select on public.app_match_source_events to authenticated;

drop policy if exists app_match_source_snapshots_staff_select on public.app_match_source_snapshots;
create policy app_match_source_snapshots_staff_select on public.app_match_source_snapshots
for select to authenticated using ((select private.is_staff()));

drop policy if exists app_match_source_events_staff_select on public.app_match_source_events;
create policy app_match_source_events_staff_select on public.app_match_source_events
for select to authenticated using ((select private.is_staff()));
