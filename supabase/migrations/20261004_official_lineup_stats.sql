-- Le vecchie partite restano compatibili; per le nuove, i "da titolare" richiedono conferma.
do $$
declare definition text;
begin
 select pg_get_viewdef('public.app_player_season_stats'::regclass,true) into definition;
 if position('m.status = ''finished''::text AND x.started AND (m.lineup_confirmed_at' in definition)=0 then
  definition:=replace(definition,
   'm.status = ''finished''::text AND x.started',
   'm.status = ''finished''::text AND x.started AND (m.lineup_confirmed_at IS NOT NULL OR m.kickoff_at < TIMESTAMPTZ ''2026-10-04 00:00:00+02'')');
  execute 'create or replace view public.app_player_season_stats as '||definition;
 end if;
end $$;