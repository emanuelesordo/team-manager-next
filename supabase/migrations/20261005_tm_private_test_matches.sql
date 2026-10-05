-- Private test fixtures/matches. Test records are visible only to their creator and are excluded from normal public reads.
ALTER TABLE public.app_competition_fixtures
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_owner_id uuid;

ALTER TABLE public.app_matches
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_owner_id uuid;

ALTER TABLE public.app_competition_fixtures
  DROP CONSTRAINT IF EXISTS app_competition_fixtures_test_owner_check;
ALTER TABLE public.app_competition_fixtures
  ADD CONSTRAINT app_competition_fixtures_test_owner_check
  CHECK ((NOT is_test AND test_owner_id IS NULL) OR (is_test AND test_owner_id IS NOT NULL));

ALTER TABLE public.app_matches
  DROP CONSTRAINT IF EXISTS app_matches_test_owner_check;
ALTER TABLE public.app_matches
  ADD CONSTRAINT app_matches_test_owner_check
  CHECK ((NOT is_test AND test_owner_id IS NULL) OR (is_test AND test_owner_id IS NOT NULL));

CREATE OR REPLACE FUNCTION private.tm_can_read_fixture(p_fixture_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
 SELECT coalesce((
   SELECT (NOT f.is_test OR f.test_owner_id=auth.uid())
   FROM public.app_competition_fixtures f
   WHERE f.id=p_fixture_id
 ),false)
$function$;

CREATE OR REPLACE FUNCTION private.tm_can_read_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
 SELECT coalesce((
   SELECT (NOT m.is_test OR m.test_owner_id=auth.uid())
   FROM public.app_matches m
   WHERE m.id=p_match_id
 ),false)
$function$;

DROP POLICY IF EXISTS "competition fixtures readable" ON public.app_competition_fixtures;
DROP POLICY IF EXISTS "competition fixtures staff write" ON public.app_competition_fixtures;
DROP POLICY IF EXISTS "competition fixtures staff insert" ON public.app_competition_fixtures;
DROP POLICY IF EXISTS "competition fixtures staff update" ON public.app_competition_fixtures;
DROP POLICY IF EXISTS "competition fixtures staff delete" ON public.app_competition_fixtures;

CREATE POLICY "competition fixtures readable"
ON public.app_competition_fixtures
FOR SELECT TO public
USING (NOT is_test OR test_owner_id=auth.uid());

CREATE POLICY "competition fixtures staff insert"
ON public.app_competition_fixtures
FOR INSERT TO authenticated
WITH CHECK (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));

CREATE POLICY "competition fixtures staff update"
ON public.app_competition_fixtures
FOR UPDATE TO authenticated
USING (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()))
WITH CHECK (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));

CREATE POLICY "competition fixtures staff delete"
ON public.app_competition_fixtures
FOR DELETE TO authenticated
USING (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));

DROP POLICY IF EXISTS app_matches_read ON public.app_matches;
CREATE POLICY app_matches_read
ON public.app_matches
FOR SELECT TO anon,authenticated
USING (NOT is_test OR test_owner_id=auth.uid());

DROP POLICY IF EXISTS app_match_players_read ON public.app_match_players;
CREATE POLICY app_match_players_read
ON public.app_match_players
FOR SELECT TO anon,authenticated
USING (private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS app_events_read ON public.app_match_events;
CREATE POLICY app_events_read
ON public.app_match_events
FOR SELECT TO anon,authenticated
USING (validation_status<>'rejected' AND private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS tm_app_events_staff_read_rejected ON public.app_match_events;
CREATE POLICY tm_app_events_staff_read_rejected
ON public.app_match_events
FOR SELECT TO authenticated
USING (private.is_staff() AND private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS app_tactical_public_read ON public.app_match_tactical_changes;
CREATE POLICY app_tactical_public_read
ON public.app_match_tactical_changes
FOR SELECT TO anon,authenticated
USING (private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS app_ratings_read ON public.app_match_ratings;
CREATE POLICY app_ratings_read
ON public.app_match_ratings
FOR SELECT TO authenticated
USING (private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS tm_app_event_revisions_staff_select ON public.tm_app_event_revisions;
CREATE POLICY tm_app_event_revisions_staff_select
ON public.tm_app_event_revisions
FOR SELECT TO authenticated
USING (private.is_staff() AND private.tm_can_read_match(match_id));

CREATE OR REPLACE FUNCTION public.tm_app_create_test_fixture(p_competition_id uuid,p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_uid uuid:=auth.uid();
 v_role text;
 c public.app_competitions%ROWTYPE;
 s public.app_seasons%ROWTYPE;
 v_round integer;
 v_kick timestamptz;
 v_home_name text;
 v_away_name text;
 v_home_team uuid;
 v_home_opp uuid;
 v_away_team uuid;
 v_away_opp uuid;
 v_venue text;
 v_address text;
 v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
 IF coalesce(v_role,'')<>'admin' THEN RAISE EXCEPTION 'I match di test privati sono riservati agli amministratori'; END IF;
 IF jsonb_typeof(p_row)<>'object' THEN RAISE EXCEPTION 'Dati partita non validi'; END IF;

 SELECT * INTO c FROM public.app_competitions WHERE id=p_competition_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Competizione inesistente'; END IF;
 SELECT * INTO s FROM public.app_seasons WHERE id=c.season_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stagione inesistente'; END IF;

 v_round:=nullif(p_row->>'round_no','')::integer;
 v_kick:=nullif(p_row->>'kickoff_at','')::timestamptz;
 v_home_name:=nullif(btrim(p_row->>'home_team'),'');
 v_away_name:=nullif(btrim(p_row->>'away_team'),'');
 v_home_team:=nullif(p_row->>'home_team_id','')::uuid;
 v_home_opp:=nullif(p_row->>'home_opponent_id','')::uuid;
 v_away_team:=nullif(p_row->>'away_team_id','')::uuid;
 v_away_opp:=nullif(p_row->>'away_opponent_id','')::uuid;
 v_venue:=nullif(btrim(p_row->>'venue_name'),'');
 v_address:=nullif(btrim(p_row->>'venue_address'),'');

 IF v_round IS NULL OR v_round NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Giornata non valida'; END IF;
 IF v_kick IS NULL THEN RAISE EXCEPTION 'Data e ora obbligatorie'; END IF;
 IF v_kick < s.start_date-interval '90 days' OR v_kick>s.end_date+interval '150 days' THEN
   RAISE EXCEPTION 'Data fuori dai limiti della stagione';
 END IF;
 IF ((v_home_team IS NOT NULL)::int+(v_home_opp IS NOT NULL)::int)<>1
    OR ((v_away_team IS NOT NULL)::int+(v_away_opp IS NOT NULL)::int)<>1 THEN
   RAISE EXCEPTION 'Associazione squadre non valida';
 END IF;
 IF v_home_team IS NOT DISTINCT FROM v_away_team AND v_home_opp IS NOT DISTINCT FROM v_away_opp THEN
   RAISE EXCEPTION 'Casa e ospite coincidono';
 END IF;

 BEGIN
  INSERT INTO public.app_competition_fixtures(
    season_id,competition_id,round_no,kickoff_at,home_team,away_team,
    home_team_id,home_opponent_id,away_team_id,away_opponent_id,
    venue_name,venue_address,status,home_score,away_score,source,
    source_imported_at,is_test,test_owner_id
  )
  VALUES(
    c.season_id,c.id,v_round,v_kick,v_home_name,v_away_name,
    v_home_team,v_home_opp,v_away_team,v_away_opp,
    v_venue,v_address,'scheduled',NULL,NULL,'private_test',
    clock_timestamp(),true,v_uid
  )
  RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Esiste già la stessa coppia di squadre in questa giornata. Per il test scegli una giornata diversa.';
 END;

 RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.tm_app_create_test_fixture(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_create_test_fixture(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.tm_app_ensure_match(p_fixture_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE f public.app_competition_fixtures%ROWTYPE;
  v_team public.teams%ROWTYPE; v_opponent uuid; v_away text; v_side text;
  v_existing uuid; v_count int;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
 SELECT * INTO f FROM public.app_competition_fixtures WHERE id=p_fixture_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fixture inesistente'; END IF;
 IF f.is_test AND f.test_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Match di test non accessibile'; END IF;

 SELECT t.* INTO v_team FROM public.teams t JOIN public.app_seasons s ON s.team_id=t.id
 WHERE s.id=f.season_id;
 IF v_team.id IS NULL THEN RAISE EXCEPTION 'Squadra non individuata'; END IF;
 IF lower(btrim(f.home_team))=lower(btrim(v_team.name))
    OR lower(btrim(f.home_team))=lower(btrim(v_team.short_name)) THEN
   v_side:='home';v_away:=f.away_team;
 ELSIF lower(btrim(f.away_team))=lower(btrim(v_team.name))
    OR lower(btrim(f.away_team))=lower(btrim(v_team.short_name)) THEN
   v_side:='away';v_away:=f.home_team;
 ELSE
   RAISE EXCEPTION 'La fixture non appartiene alla squadra principale';
 END IF;

 SELECT id INTO v_existing FROM public.app_matches WHERE fixture_id=f.id;
 IF FOUND THEN RETURN v_existing; END IF;
 IF f.status IN ('live','finished') THEN
  RAISE EXCEPTION 'Gara ufficiale già avviata o conclusa senza tabellino collegato: riconciliazione manuale necessaria';
 END IF;

 SELECT count(*),min(id::text)::uuid INTO v_count,v_opponent FROM public.app_opponents
 WHERE lower(btrim(name))=lower(btrim(v_away))
    OR (short_name IS NOT NULL AND lower(btrim(short_name))=lower(btrim(v_away)));
 IF v_count<>1 THEN RAISE EXCEPTION 'Avversaria non univoca o non censita: %',v_away; END IF;

 SELECT count(*),min(id::text)::uuid INTO v_count,v_existing FROM public.app_matches
 WHERE season_id=f.season_id AND competition_id=f.competition_id
  AND opponent_id=v_opponent AND home_away=v_side AND fixture_id IS NULL
  AND is_test=f.is_test
  AND (NOT f.is_test OR test_owner_id=f.test_owner_id)
  AND abs(extract(epoch from kickoff_at-f.kickoff_at)) <= 36*3600;
 IF v_count>1 THEN RAISE EXCEPTION 'Più tabellini compatibili: associazione automatica non sicura'; END IF;

 IF v_count=1 THEN
  UPDATE public.app_matches
  SET fixture_id=f.id,is_test=f.is_test,test_owner_id=f.test_owner_id
  WHERE id=v_existing;
 ELSE
  INSERT INTO public.app_matches(
   season_id,competition_id,opponent_id,kickoff_at,venue,
   venue_name,venue_address,home_away,round_label,status,home_score,away_score,
   fixture_id,live_period,is_test,test_owner_id
  )
  VALUES(
   f.season_id,f.competition_id,v_opponent,f.kickoff_at,f.venue,
   f.venue_name,f.venue_address,v_side,coalesce(f.round_no::text,''),
   CASE WHEN f.status IN ('live','finished') THEN f.status ELSE 'scheduled' END,
   coalesce(f.home_score,0),coalesce(f.away_score,0),f.id,
   CASE WHEN f.status='finished' THEN 'finished' ELSE 'pre' END,
   f.is_test,f.test_owner_id
  )
  RETURNING id INTO v_existing;
 END IF;
 RETURN v_existing;
END
$function$;
