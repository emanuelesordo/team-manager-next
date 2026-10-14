CREATE TABLE IF NOT EXISTS public.app_match_player_calculated (
match_id uuid NOT NULL REFERENCES public.app_matches(id) ON DELETE CASCADE,
player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
season_id uuid NOT NULL, appeared boolean NOT NULL, started boolean NOT NULL, subentered boolean NOT NULL,
minutes integer, timeline_valid boolean NOT NULL,goals_for_on integer,goals_against_on integer,
plus_minus integer GENERATED ALWAYS AS (goals_for_on-goals_against_on) STORED,
score_coverage text NOT NULL DEFAULT 'unavailable',calculated_at timestamptz NOT NULL DEFAULT now(),
PRIMARY KEY(match_id,player_id));
CREATE INDEX IF NOT EXISTS app_match_player_calculated_season_idx ON public.app_match_player_calculated(season_id,player_id);
ALTER TABLE public.app_match_player_calculated ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.app_match_player_calculated FROM anon,authenticated;
GRANT SELECT ON public.app_match_player_calculated TO anon,authenticated;
DROP POLICY IF EXISTS app_match_player_calculated_read ON public.app_match_player_calculated;
CREATE POLICY app_match_player_calculated_read ON public.app_match_player_calculated FOR SELECT TO anon,authenticated USING(true);
CREATE OR REPLACE FUNCTION private.tm_app_elapsed_minute(p_match uuid, p_event app_match_events)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH c AS (
 SELECT coalesce(nullif(m.minutes_per_period_override,0),nullif(cp.minutes_per_period,0),40)::numeric half
 FROM public.app_matches m LEFT JOIN public.app_competitions cp ON cp.id=m.competition_id WHERE m.id=p_match
 ), recovery AS (
 SELECT greatest(0,coalesce(
 CASE WHEN e.payload->>'recovery_actual' ~ '^[0-9]+$' THEN (e.payload->>'recovery_actual')::numeric END,
 CASE WHEN e.payload->>'recovery_minutes' ~ '^[0-9]+$' THEN (e.payload->>'recovery_minutes')::numeric END,
 e.stoppage_minute::numeric,0)) as r
 FROM public.app_match_events e WHERE e.match_id=p_match
 AND e.event_type='period_end' AND e.validation_status IN ('official','community_confirmed')
 AND e.payload->>'period'='first_half'
 ORDER BY (e.payload->>'recovery_actual' IS NOT NULL) DESC,(e.payload->>'entered_from'='period_control') DESC,e.created_at DESC NULLS LAST,e.id DESC
 LIMIT 1
 )
 SELECT CASE
 WHEN p_event.payload->>'period'='halftime' THEN c.half+coalesce((select r from recovery),0)
 WHEN p_event.minute IS NULL THEN NULL
 ELSE p_event.minute
 +CASE WHEN p_event.payload->>'period'='second_half'
     AND coalesce(p_event.payload->>'minute_relative','true')<>'false'
     AND coalesce(p_event.payload->>'entered_from','')<>'tm_app_live'
   THEN c.half ELSE 0 END
 +CASE WHEN p_event.payload->>'period'='second_half'
       OR p_event.payload->>'period_no'='2'
       OR (p_event.minute>c.half AND coalesce(p_event.payload->>'period','')<>'first_half')
   THEN coalesce((select r from recovery),0) ELSE 0 END
 +greatest(0,coalesce(p_event.stoppage_minute,0))
 END
 FROM c
 $function$;

CREATE OR REPLACE FUNCTION private.tm_app_refresh_calculated_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE before_id uuid; after_id uuid;
BEGIN
 IF TG_TABLE_NAME='app_competition_fixtures' THEN
  FOR after_id IN SELECT id FROM public.app_matches WHERE fixture_id=NEW.id LOOP
   PERFORM private.tm_app_refresh_match_calculated(after_id);
  END LOOP;
 ELSE
  IF TG_OP IN ('UPDATE','DELETE') THEN
   IF TG_TABLE_NAME='app_matches' THEN before_id=OLD.id; ELSE before_id=OLD.match_id; END IF;
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
   IF TG_TABLE_NAME='app_matches' THEN after_id=NEW.id; ELSE after_id=NEW.match_id; END IF;
  END IF;
  IF before_id IS NOT NULL THEN PERFORM private.tm_app_refresh_match_calculated(before_id); END IF;
  IF after_id IS NOT NULL AND after_id IS DISTINCT FROM before_id THEN
   PERFORM private.tm_app_refresh_match_calculated(after_id);
  END IF;
 END IF;
 RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION private.tm_app_refresh_match_calculated(p_match uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m record; expected_goals integer; actual_goals integer; valid_score boolean;
BEGIN
 SELECT am.id,am.status,am.is_test,am.season_id,am.home_away,
  f.home_score,f.away_score
 INTO m FROM public.app_matches am LEFT JOIN public.app_competition_fixtures f ON f.id=am.fixture_id
 WHERE am.id=p_match;
 DELETE FROM public.app_match_player_calculated WHERE match_id=p_match;
 IF NOT FOUND AND m.id IS NULL THEN RETURN; END IF;
 IF m.id IS NULL OR m.is_test OR m.status<>'finished' THEN RETURN; END IF;
 expected_goals=coalesce(m.home_score,0)+coalesce(m.away_score,0);
 SELECT count(*) INTO actual_goals
 FROM public.app_match_events e WHERE e.match_id=p_match
 AND e.validation_status IN ('official','community_confirmed')
 AND e.event_type IN ('goal','penalty_goal','penalty_scored','own_goal')
 AND coalesce(e.payload->>'count_score','true')<>'false';
 valid_score=m.home_score IS NOT NULL AND m.away_score IS NOT NULL AND expected_goals=actual_goals;

 INSERT INTO public.app_match_player_calculated
 (match_id,player_id,season_id,appeared,started,subentered,minutes,timeline_valid,goals_for_on,goals_against_on,score_coverage,calculated_at)
 SELECT p.match_id,p.player_id,p.season_id,p.appeared,p.started,p.subentered,p.minutes,p.valid,
 CASE WHEN valid_score AND p.valid AND checks.good THEN counts.gf ELSE NULL END,
 CASE WHEN valid_score AND p.valid AND checks.good THEN counts.ga ELSE NULL END,
 CASE WHEN valid_score AND p.valid AND checks.good THEN 'complete' ELSE 'unavailable' END,
 now()
 FROM private.tm_player_match_participation p
 CROSS JOIN LATERAL (
 SELECT
 coalesce(bool_and(g.t IS NOT NULL AND g.t>=0 AND g.t<=p.duration AND g.score_side IN('team','opponent')),true)
  AND coalesce(bool_and(g.own_side_known),true) AS good
 FROM (
  SELECT private.tm_app_elapsed_minute(p_match,e) t,
   CASE WHEN e.event_type='own_goal'
    THEN CASE WHEN e.team_side='team' THEN 'opponent' WHEN e.team_side='opponent' THEN 'team'
      WHEN e.team_side='home' THEN CASE WHEN m.home_away='home' THEN 'opponent' ELSE 'team' END
      WHEN e.team_side='away' THEN CASE WHEN m.home_away='away' THEN 'opponent' ELSE 'team' END END
    ELSE CASE WHEN e.team_side IN('team','opponent') THEN e.team_side
      WHEN e.team_side='home' THEN CASE WHEN m.home_away='home' THEN 'team' ELSE 'opponent' END
      WHEN e.team_side='away' THEN CASE WHEN m.home_away='away' THEN 'team' ELSE 'opponent' END END END score_side,
   (e.team_side IN('team','opponent','home','away')) own_side_known
  FROM public.app_match_events e
  WHERE e.match_id=p_match AND e.validation_status IN('official','community_confirmed')
   AND e.event_type IN('goal','penalty_goal','penalty_scored','own_goal')
   AND coalesce(e.payload->>'count_score','true')<>'false'
 ) g
 ) checks
 CROSS JOIN LATERAL (
 SELECT
 count(*) FILTER(WHERE g.score_side='team' AND g.onfield)::integer gf,
 count(*) FILTER(WHERE g.score_side='opponent' AND g.onfield)::integer ga,
 count(*) FILTER(WHERE g.score_side='team')::integer total_gf,
 count(*) FILTER(WHERE g.score_side='opponent')::integer total_ga
 FROM (
 SELECT
 CASE WHEN e.event_type='own_goal'
  THEN CASE WHEN e.team_side='team' THEN 'opponent' WHEN e.team_side='opponent' THEN 'team'
   WHEN e.team_side='home' THEN CASE WHEN m.home_away='home' THEN 'opponent' ELSE 'team' END
   WHEN e.team_side='away' THEN CASE WHEN m.home_away='away' THEN 'opponent' ELSE 'team' END END
  ELSE CASE WHEN e.team_side IN('team','opponent') THEN e.team_side
   WHEN e.team_side='home' THEN CASE WHEN m.home_away='home' THEN 'team' ELSE 'opponent' END
   WHEN e.team_side='away' THEN CASE WHEN m.home_away='away' THEN 'team' ELSE 'opponent' END END END AS score_side,
 (p.started::int
 +coalesce((SELECT count(*) FROM public.app_match_events s
    WHERE s.match_id=p_match AND s.event_type='substitution'
      AND s.validation_status IN('official','community_confirmed') AND s.secondary_player_id=p.player_id
      AND private.tm_app_elapsed_minute(p_match,s)<=private.tm_app_elapsed_minute(p_match,e)),0)
 -coalesce((SELECT count(*) FROM public.app_match_events s
    WHERE s.match_id=p_match AND s.event_type='substitution'
      AND s.validation_status IN('official','community_confirmed') AND s.player_id=p.player_id
      AND private.tm_app_elapsed_minute(p_match,s)<=private.tm_app_elapsed_minute(p_match,e)),0)
 -coalesce((SELECT count(*) FROM public.app_match_events s
    WHERE s.match_id=p_match AND s.event_type IN('red_card','second_yellow','blue_card')
      AND s.validation_status IN('official','community_confirmed') AND s.player_id=p.player_id
      AND private.tm_app_elapsed_minute(p_match,s)<=private.tm_app_elapsed_minute(p_match,e)),0)
 +coalesce((SELECT count(*) FROM public.app_match_events s
    WHERE s.match_id=p_match AND s.event_type IN('blue_return','temporary_return','return_from_blue')
      AND s.validation_status IN('official','community_confirmed') AND s.player_id=p.player_id
      AND private.tm_app_elapsed_minute(p_match,s)<=private.tm_app_elapsed_minute(p_match,e)),0)
 )>0 AS onfield
 FROM public.app_match_events e
 WHERE e.match_id=p_match AND e.validation_status IN('official','community_confirmed')
  AND e.event_type IN('goal','penalty_goal','penalty_scored','own_goal')
  AND coalesce(e.payload->>'count_score','true')<>'false'
 ) g
 ) counts
 WHERE p.match_id=p_match;
 -- A scoreline mismatch invalidates ALL affected on-field metrics rather than producing plausible partial values.
 IF valid_score THEN
 UPDATE public.app_match_player_calculated x SET goals_for_on=NULL,goals_against_on=NULL,score_coverage='unavailable'
 WHERE x.match_id=p_match
 AND EXISTS(
  SELECT 1 FROM public.app_competition_fixtures f JOIN public.app_matches mm ON mm.fixture_id=f.id
  WHERE mm.id=p_match AND (
   (m.home_away='home' AND (SELECT count(*) FROM public.app_match_events e WHERE e.match_id=p_match
     AND e.event_type IN('goal','penalty_goal','penalty_scored') AND e.team_side='team'
     AND e.validation_status IN('official','community_confirmed'))<>f.home_score)
  )
 );
 END IF;
END $function$;
REVOKE ALL ON FUNCTION private.tm_app_elapsed_minute(uuid,public.app_match_events) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tm_app_refresh_match_calculated(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tm_app_refresh_calculated_trigger() FROM PUBLIC;
DROP TRIGGER IF EXISTS tm_refresh_event_calculated ON public.app_match_events;
CREATE TRIGGER tm_refresh_event_calculated AFTER INSERT OR UPDATE OR DELETE ON public.app_match_events FOR EACH ROW EXECUTE FUNCTION private.tm_app_refresh_calculated_trigger();
DROP TRIGGER IF EXISTS tm_refresh_lineup_calculated ON public.app_match_players;
CREATE TRIGGER tm_refresh_lineup_calculated AFTER INSERT OR UPDATE OR DELETE ON public.app_match_players FOR EACH ROW EXECUTE FUNCTION private.tm_app_refresh_calculated_trigger();
DROP TRIGGER IF EXISTS tm_refresh_match_calculated ON public.app_matches;
CREATE TRIGGER tm_refresh_match_calculated AFTER INSERT OR UPDATE OR DELETE ON public.app_matches FOR EACH ROW EXECUTE FUNCTION private.tm_app_refresh_calculated_trigger();
DROP TRIGGER IF EXISTS tm_refresh_fixture_calculated ON public.app_competition_fixtures;
CREATE TRIGGER tm_refresh_fixture_calculated AFTER UPDATE OF home_score,away_score,status ON public.app_competition_fixtures FOR EACH ROW EXECUTE FUNCTION private.tm_app_refresh_calculated_trigger();
DO $backfill$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.app_matches WHERE status='finished' AND NOT is_test LOOP PERFORM private.tm_app_refresh_match_calculated(r.id); END LOOP; END $backfill$;
NOTIFY pgrst,'reload schema';