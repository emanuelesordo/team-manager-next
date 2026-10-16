-- Player role affinities: staff-curated profile, separate from crowd evaluations.
-- Natural role is the unique 100% position. Empty profiles are not automatically inferred.
insert into public.football_positions(code,label,category,sort_order,active)
values ('QD','Quinto destro','midfielder',42,true),
       ('QS','Quinto sinistro','midfielder',43,true)
on conflict (code) do nothing;

create table if not exists public.app_player_role_affinities (
 player_id uuid not null references public.players(id) on delete cascade,
 position_id uuid not null references public.football_positions(id),
 affinity_pct smallint not null check (affinity_pct between 1 and 100),
 is_natural boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (player_id,position_id),
 constraint tm_player_natural_role_100 check (not is_natural or affinity_pct=100)
);
create unique index if not exists tm_one_natural_player_role
 on public.app_player_role_affinities(player_id) where is_natural;
create index if not exists tm_role_affinity_position_idx
 on public.app_player_role_affinities(position_id);
alter table public.app_player_role_affinities enable row level security;

revoke all on public.app_player_role_affinities from public,anon,authenticated;
grant select on public.app_player_role_affinities to anon,authenticated;
drop policy if exists tm_public_player_role_affinities_read on public.app_player_role_affinities;
create policy tm_public_player_role_affinities_read
 on public.app_player_role_affinities for select to anon,authenticated
 using (exists (select 1 from public.players p where p.id=player_id));

-- Position labels are non-sensitive public metadata. Existing auth policy is kept.
grant select on public.football_positions to anon,authenticated;
drop policy if exists tm_public_football_positions_read on public.football_positions;
create policy tm_public_football_positions_read
 on public.football_positions for select to anon using (active=true);

create or replace function public.tm_app_save_player_roles(
 p_season_id uuid,p_player_id uuid,p_roles jsonb
) returns void
language plpgsql security definer set search_path=''
as $function$
declare
 v_team uuid;
 v_person_team uuid;
 v_item jsonb;
 v_code text;
 v_pct smallint;
 v_natural boolean;
 v_natural_count integer := 0;
 v_seen text[] := '{}'::text[];
 v_position uuid;
begin
 if (select auth.uid()) is null or not private.is_staff() then
  raise exception 'Operazione riservata allo staff';
 end if;
 select team_id into v_team from public.app_seasons where id=p_season_id;
 select team_id into v_person_team from public.players where id=p_player_id;
 if v_team is null or v_person_team is distinct from v_team
    or v_team <> 'd0c3210b-6a8a-4a1b-93c8-e2400029006e'::uuid then
  raise exception 'Giocatore non appartenente alla stagione e squadra autorizzate';
 end if;
 if p_roles is null or jsonb_typeof(p_roles)<>'array' or
    jsonb_array_length(p_roles)<1 or jsonb_array_length(p_roles)>25 then
  raise exception 'Seleziona un ruolo naturale e fino a 24 ruoli secondari';
 end if;
 -- Validate the entire input before modifying the saved profile.
 for v_item in select value from jsonb_array_elements(p_roles)
 loop
  v_code:=nullif(btrim(v_item->>'code'),'');
  if v_code is null or v_code=any(v_seen) then
   raise exception 'Ruolo mancante o duplicato';
  end if;
  v_seen:=array_append(v_seen,v_code);
  select id into v_position from public.football_positions
   where code=v_code and active=true;
  if v_position is null then raise exception 'Ruolo non riconosciuto: %',v_code;end if;
  if (v_item->>'affinity') !~ '^[0-9]{1,3}$' then
   raise exception 'Affinità non valida: %',v_code;
  end if;
  v_pct:=(v_item->>'affinity')::smallint;
  if v_pct<1 or v_pct>100 then raise exception 'Affinità fuori intervallo';end if;
  v_natural:=coalesce((v_item->>'natural')::boolean,false);
  if v_natural and v_pct<>100 then raise exception 'Il ruolo naturale deve essere al 100%%';end if;
  if v_natural then v_natural_count:=v_natural_count+1;end if;
 end loop;
 if v_natural_count<>1 then raise exception 'Indica un solo ruolo naturale';end if;
 delete from public.app_player_role_affinities where player_id=p_player_id;
 insert into public.app_player_role_affinities(player_id,position_id,affinity_pct,is_natural)
 select p_player_id,fp.id,(item.value->>'affinity')::smallint,
        coalesce((item.value->>'natural')::boolean,false)
 from jsonb_array_elements(p_roles) as item(value)
 join public.football_positions fp on fp.code=item.value->>'code' and fp.active=true;
end;
$function$;
revoke all on function public.tm_app_save_player_roles(uuid,uuid,jsonb) from public,anon;
grant execute on function public.tm_app_save_player_roles(uuid,uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
