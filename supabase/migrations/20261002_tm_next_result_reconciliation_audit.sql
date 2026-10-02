-- Adds an immutable history for explicit score synchronization (fixture remains authoritative).
-- Applied to production Supabase before commit; safe to replay.
CREATE TABLE IF NOT EXISTS public.tm_app_result_reconciliations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 match_id uuid NOT NULL REFERENCES public.app_matches(id) ON DELETE RESTRICT,
 fixture_id uuid NOT NULL REFERENCES public.app_competition_fixtures(id) ON DELETE RESTRICT,
 editor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 old_home_score smallint NOT NULL,old_away_score smallint NOT NULL,
 new_home_score smallint NOT NULL,new_away_score smallint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tm_app_result_reconciliations_match_idx
 ON public.tm_app_result_reconciliations(match_id,created_at DESC);
ALTER TABLE public.tm_app_result_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_app_result_reconciliations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tm_app_result_reconciliations TO authenticated;
DROP POLICY IF EXISTS tm_app_result_reconciliations_staff_select ON public.tm_app_result_reconciliations;
CREATE POLICY tm_app_result_reconciliations_staff_select ON public.tm_app_result_reconciliations
 FOR SELECT TO authenticated USING ((SELECT private.is_staff()));
CREATE OR REPLACE FUNCTION public.tm_app_review_result(p_match_id uuid, p_action text, p_expected_home integer, p_expected_away integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE; pending integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso riservato allo staff';END IF;
 IF p_action NOT IN('confirm','reopen','align_operational') THEN RAISE EXCEPTION 'Azione risultato non valida';END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.fixture_id IS NULL OR m.status<>'finished' THEN RAISE EXCEPTION 'Partita operativa non conclusa';END IF;
 SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
 IF NOT FOUND OR f.status<>'finished' THEN RAISE EXCEPTION 'Fixture ufficiale non conclusa';END IF;
 IF f.home_score IS NULL OR f.away_score IS NULL OR f.home_score IS DISTINCT FROM p_expected_home
 OR f.away_score IS DISTINCT FROM p_expected_away THEN
  RAISE EXCEPTION 'Il risultato ufficiale è cambiato: aggiorna il tabellino';END IF;
 IF p_action='align_operational' THEN
  IF m.result_review_status='confirmed' THEN RAISE EXCEPTION 'Revoca prima la conferma ufficiale';END IF;
  -- The fixture is the official source, never overwrite its score.
  UPDATE public.app_matches SET home_score=f.home_score,away_score=f.away_score WHERE id=m.id;
  INSERT INTO public.tm_app_result_reconciliations(match_id,fixture_id,editor_id,old_home_score,old_away_score,new_home_score,new_away_score)
  VALUES(m.id,f.id,auth.uid(),m.home_score,m.away_score,f.home_score,f.away_score);
 ELSIF p_action='reopen' THEN
  UPDATE public.app_matches SET result_review_status='provisional',
    result_reviewed_at=NULL,result_reviewed_by=NULL WHERE id=m.id;
 ELSE
  IF m.home_score IS DISTINCT FROM f.home_score OR m.away_score IS DISTINCT FROM f.away_score THEN
   RAISE EXCEPTION 'Punteggi operativi e ufficiali diversi: riconcilia prima il tabellino';END IF;
  SELECT count(*) INTO pending FROM public.app_match_events
  WHERE match_id=m.id AND validation_status IN('proposed','community_confirmed','disputed');
  IF pending>0 THEN RAISE EXCEPTION 'Revisiona prima % eventi ancora da verificare',pending;END IF;
  UPDATE public.app_matches SET result_review_status='confirmed',
    result_reviewed_at=clock_timestamp(),result_reviewed_by=auth.uid() WHERE id=m.id;
 END IF;
 RETURN jsonb_build_object('match_id',m.id,'action',p_action,'fixture_id',f.id,
 'official_home',f.home_score,'official_away',f.away_score);
END $function$
;