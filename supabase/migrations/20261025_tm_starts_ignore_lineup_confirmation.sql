-- Titolarità: il dato sportivo è app_match_players.started, non il timestamp di conferma formazione.
-- Corregge tutte le stagioni e tutti i giocatori mantenendo intatto il resto della vista.
DO $do$
DECLARE
  definition text;
  previous_condition text := 'x.started AND (m.lineup_confirmed_at IS NOT NULL OR m.kickoff_at < ''2026-10-03 22:00:00+00''::timestamp with time zone)';
BEGIN
  definition := pg_get_viewdef('public.app_player_season_stats'::regclass, true);
  IF strpos(definition, previous_condition) > 0 THEN
    definition := replace(definition, previous_condition, 'x.started');
    EXECUTE 'CREATE OR REPLACE VIEW public.app_player_season_stats AS ' || definition;
  ELSIF strpos(definition, 'AND x.started)') = 0 THEN
    RAISE EXCEPTION 'Unexpected player starts calculation: inspect view before migrating';
  END IF;
END $do$;
