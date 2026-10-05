-- Allinea il conteggio gol/assist di app_player_season_stats al criterio storico di team-manager:
-- un evento registrato come goal/penalty_scored per la squadra conta come rete del player_id,
-- indipendentemente da payload.goal_type. Gli eventi rejected restano esclusi dalla sorgente.
do $$
declare
  definition text;
  legacy_filter text := ' AND COALESCE(e.payload ->> ''goal_type''::text, ''''::text) <> ''own_goal''::text';
begin
  select pg_get_viewdef('public.app_player_season_stats'::regclass, true)
    into definition;

  if position(legacy_filter in definition) = 0 then
    raise exception 'Filtro goal_type=own_goal non trovato nella view app_player_season_stats';
  end if;

  definition := replace(definition, legacy_filter, '');
  execute 'create or replace view public.app_player_season_stats as ' || definition;
end
$$;