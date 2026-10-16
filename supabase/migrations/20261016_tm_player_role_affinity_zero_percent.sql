-- Allow an explicit 0% ('not suitable') distinct from an absent affinity row.
alter table public.app_player_role_affinities
 drop constraint if exists app_player_role_affinities_affinity_pct_check;
alter table public.app_player_role_affinities
 add constraint app_player_role_affinities_affinity_pct_check
 check (affinity_pct between 0 and 100);
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
  if v_pct<0 or v_pct>100 then raise exception 'Affinità fuori intervallo';end if;
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

notify pgrst, 'reload schema';
