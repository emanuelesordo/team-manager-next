-- Test matches must never alter official standings or season/player aggregates.
DO $$
DECLARE v text;
BEGIN
 SELECT definition INTO v FROM pg_views WHERE schemaname='public' AND viewname='app_competition_standings';
 IF v IS NOT NULL THEN
   v:=replace(v,'FROM app_competition_fixtures','FROM (SELECT * FROM public.app_competition_fixtures WHERE NOT is_test) app_competition_fixtures');
   EXECUTE 'CREATE OR REPLACE VIEW public.app_competition_standings AS '||v;
 END IF;
END $$;

DO $$
DECLARE v text;
BEGIN
 SELECT definition INTO v FROM pg_views WHERE schemaname='public' AND viewname='app_player_season_stats';
 IF v IS NOT NULL THEN
   v:=replace(v,'JOIN app_matches m','JOIN (SELECT * FROM public.app_matches WHERE NOT is_test) m');
   EXECUTE 'CREATE OR REPLACE VIEW public.app_player_season_stats AS '||v;
 END IF;
END $$;

DO $$
DECLARE v text;
BEGIN
 SELECT definition INTO v FROM pg_views WHERE schemaname='public' AND viewname='tm_player_recent_votes';
 IF v IS NOT NULL THEN
   v:=replace(v,'JOIN app_matches m','JOIN (SELECT * FROM public.app_matches WHERE NOT is_test) m');
   EXECUTE 'CREATE OR REPLACE VIEW public.tm_player_recent_votes AS '||v;
 END IF;
END $$;

DO $$
DECLARE v text;
BEGIN
 SELECT definition INTO v FROM pg_views WHERE schemaname='public' AND viewname='tm_player_habitual_shirts';
 IF v IS NOT NULL THEN
   v:=replace(v,'JOIN app_matches m','JOIN (SELECT * FROM public.app_matches WHERE NOT is_test) m');
   EXECUTE 'CREATE OR REPLACE VIEW public.tm_player_habitual_shirts AS '||v;
 END IF;
END $$;

ALTER VIEW public.app_match_score SET (security_invoker = true);
