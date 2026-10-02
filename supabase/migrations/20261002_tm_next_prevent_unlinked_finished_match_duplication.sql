-- Deployed guard against duplicate operational matches on unlinked live/finished fixtures.
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
  AND abs(extract(epoch from kickoff_at-f.kickoff_at)) <= 36*3600;
 IF v_count>1 THEN RAISE EXCEPTION 'Più tabellini compatibili: associazione automatica non sicura'; END IF;
 IF v_count=1 THEN
  UPDATE public.app_matches SET fixture_id=f.id WHERE id=v_existing;
 ELSE
  INSERT INTO public.app_matches(season_id,competition_id,opponent_id,kickoff_at,venue,
   venue_name,venue_address,home_away,round_label,status,home_score,away_score,fixture_id,live_period)
  VALUES(f.season_id,f.competition_id,v_opponent,f.kickoff_at,f.venue,f.venue_name,f.venue_address,
   v_side,coalesce(f.round_no::text,''),CASE WHEN f.status IN ('live','finished') THEN f.status ELSE 'scheduled' END,
   f.home_score,f.away_score,f.id,CASE WHEN f.status='finished' THEN 'finished' ELSE 'pre' END)
  RETURNING id INTO v_existing;
 END IF;
 RETURN v_existing;
END $function$
;
