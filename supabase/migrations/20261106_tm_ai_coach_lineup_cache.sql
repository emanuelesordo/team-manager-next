-- Coach model shared cache. Accessible only from authenticated Edge Function with service role.
create table if not exists public.tm_ai_coach_lineup_cache (
 fixture_id uuid primary key references public.app_competition_fixtures(id) on delete cascade,
 fingerprint text not null,
 result jsonb,
 status text not null default 'pending' check (status in ('pending','success','error')),
 last_error text,
 retry_after timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.tm_ai_coach_lineup_cache enable row level security;
revoke all on public.tm_ai_coach_lineup_cache from anon, authenticated;
grant all on public.tm_ai_coach_lineup_cache to service_role;
create index if not exists tm_ai_coach_lineup_cache_status_idx on public.tm_ai_coach_lineup_cache(status,retry_after);
