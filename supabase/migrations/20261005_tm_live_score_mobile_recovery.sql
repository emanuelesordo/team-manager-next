alter table public.app_matches
  add column if not exists live_recovery_minutes smallint not null default 0,
  add column if not exists live_recovery_period_no smallint;

alter table public.app_matches
  drop constraint if exists app_matches_live_recovery_minutes_check;
alter table public.app_matches
  add constraint app_matches_live_recovery_minutes_check
  check (live_recovery_minutes between 0 and 30);

alter table public.app_matches
  drop constraint if exists app_matches_live_recovery_period_no_check;
alter table public.app_matches
  add constraint app_matches_live_recovery_period_no_check
  check (live_recovery_period_no is null or live_recovery_period_no between 1 and 6);

create or replace function public.tm_app_set_live_recovery(
  p_match_id uuid,
  p_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  m public.app_matches%rowtype;
  v_no integer;
begin
  if auth.uid() is null or not private.is_staff() then
    raise exception 'Accesso non autorizzato';
  end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 30 then
    raise exception 'Recupero non valido';
  end if;

  select * into m
  from public.app_matches
  where id=p_match_id
  for update;

  if not found or m.status <> 'live' then
    raise exception 'La partita non è in corso';
  end if;
  if m.is_test and m.test_owner_id is distinct from auth.uid() then
    raise exception 'Match di test non accessibile';
  end if;

  v_no:=greatest(1,coalesce(m.live_period_no,1));

  update public.app_matches
  set live_recovery_minutes=p_minutes,
      live_recovery_period_no=v_no
  where id=m.id;

  return jsonb_build_object(
    'match_id',m.id,
    'period_no',v_no,
    'recovery_minutes',p_minutes
  );
end
$$;

revoke all on function public.tm_app_set_live_recovery(uuid,integer) from public;
grant execute on function public.tm_app_set_live_recovery(uuid,integer) to authenticated;
