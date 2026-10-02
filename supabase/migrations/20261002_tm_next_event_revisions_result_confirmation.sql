-- Deployed 2026-10-02; idempotent replay.
-- Distinct result validation from completed match, with explicit audited event amendments.
ALTER TABLE public.app_matches
 ADD COLUMN IF NOT EXISTS result_review_status text NOT NULL DEFAULT 'provisional',
 ADD COLUMN IF NOT EXISTS result_reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS result_reviewed_by uuid REFERENCES auth.users(id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.app_matches'::regclass AND conname='tm_next_result_review_state_check') THEN
  ALTER TABLE public.app_matches ADD CONSTRAINT tm_next_result_review_state_check CHECK(result_review_status IN ('provisional','confirmed'));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.tm_app_event_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 match_id uuid NOT NULL REFERENCES public.app_matches(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL REFERENCES public.app_match_events(id) ON DELETE RESTRICT,
 editor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 previous_record jsonb NOT NULL,next_record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tm_app_event_revisions_match_idx ON public.tm_app_event_revisions(match_id,created_at DESC);
ALTER TABLE public.tm_app_event_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_app_event_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tm_app_event_revisions TO authenticated;
DROP POLICY IF EXISTS tm_app_event_revisions_staff_select ON public.tm_app_event_revisions;
CREATE POLICY tm_app_event_revisions_staff_select ON public.tm_app_event_revisions FOR SELECT TO authenticated USING ((SELECT private.is_staff()));
CREATE OR REPLACE FUNCTION public.tm_app_review_reset_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND
 (OLD.home_score IS DISTINCT FROM NEW.home_score
 OR OLD.away_score IS DISTINCT FROM NEW.away_score
 OR OLD.status IS DISTINCT FROM NEW.status
 OR OLD.fixture_id IS DISTINCT FROM NEW.fixture_id) THEN
  NEW.result_review_status:='provisional';
  NEW.result_reviewed_at:=NULL;NEW.result_reviewed_by:=NULL;
 END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.tm_app_review_reset_fixture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF OLD.home_score IS DISTINCT FROM NEW.home_score
  OR OLD.away_score IS DISTINCT FROM NEW.away_score
  OR OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE public.app_matches SET result_review_status='provisional',
   result_reviewed_at=NULL,result_reviewed_by=NULL
   WHERE fixture_id=NEW.id AND result_review_status='confirmed';
 END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.tm_app_review_reset_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 UPDATE public.app_matches SET result_review_status='provisional',
  result_reviewed_at=NULL,result_reviewed_by=NULL
 WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.match_id ELSE NEW.match_id END
 AND result_review_status='confirmed';
 RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION public.tm_app_amend_event(p_match_id uuid, p_event_id uuid, p_expected_status text, p_changes jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.app_matches%ROWTYPE; e public.app_match_events%ROWTYPE;
 v_type text; v_side text; v_player uuid;v_secondary uuid;
 v_minute integer;v_stoppage integer;v_reason text;v_notes text;
 v_payload jsonb;v_before jsonb;v_after jsonb;v_now timestamptz:=clock_timestamp();
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso riservato allo staff'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Rettifica non valida';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Indica il motivo della rettifica (5–500 caratteri)';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) x
   WHERE x NOT IN('event_type','team_side','player_id','secondary_player_id',
    'minute','stoppage_minute','substitution_reason','notes')) THEN
  RAISE EXCEPTION 'Campo non rettificabile';END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.fixture_id IS NULL OR m.status NOT IN('live','finished') THEN
  RAISE EXCEPTION 'Tabellino non collegato o in stato non modificabile';END IF;
 SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id AND match_id=m.id FOR UPDATE;
 IF NOT FOUND OR e.validation_status IS DISTINCT FROM p_expected_status THEN
  RAISE EXCEPTION 'Evento aggiornato altrove: ricarica prima di rettificare';END IF;
 v_type:=coalesce(p_changes->>'event_type',e.event_type);
 v_side:=coalesce(p_changes->>'team_side',e.team_side);
 v_player:=CASE WHEN p_changes ? 'player_id' THEN nullif(p_changes->>'player_id','')::uuid ELSE e.player_id END;
 v_secondary:=CASE WHEN p_changes ? 'secondary_player_id' THEN nullif(p_changes->>'secondary_player_id','')::uuid ELSE e.secondary_player_id END;
 v_minute:=CASE WHEN p_changes ? 'minute' THEN nullif(p_changes->>'minute','')::integer ELSE e.minute END;
 v_stoppage:=CASE WHEN p_changes ? 'stoppage_minute' THEN nullif(p_changes->>'stoppage_minute','')::integer ELSE e.stoppage_minute END;
 v_reason:=CASE WHEN p_changes ? 'substitution_reason' THEN nullif(p_changes->>'substitution_reason','') ELSE e.substitution_reason END;
 v_notes:=CASE WHEN p_changes ? 'notes' THEN p_changes->>'notes' ELSE e.payload->>'notes' END;
 IF v_type NOT IN('goal','own_goal','penalty_scored','penalty_missed','yellow_card','blue_card','blue_return','red_card','substitution','period_end','other','assist') THEN RAISE EXCEPTION 'Tipo evento non valido';END IF;
 IF v_side NOT IN('team','opponent') OR
 (v_minute IS NOT NULL AND (v_minute<0 OR v_minute>300)) OR
 (v_stoppage IS NOT NULL AND (v_stoppage<0 OR v_stoppage>30)) OR
 length(coalesce(v_notes,''))>400 THEN RAISE EXCEPTION 'Valori di rettifica non validi';END IF;
 IF coalesce((e.payload->>'counted_in_score')::boolean,false)
 AND (v_type IS DISTINCT FROM e.event_type OR v_side IS DISTINCT FROM e.team_side) THEN
  RAISE EXCEPTION 'Gol conteggiato nel tabellone: non cambiare tipo/squadra senza riconciliare il risultato';
 END IF;
 IF v_side='opponent' AND (v_player IS NOT NULL OR v_secondary IS NOT NULL) THEN
  RAISE EXCEPTION 'Gli ID giocatore appartengono solo alla nostra squadra';END IF;
 IF v_side='team' AND (
  (v_player IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.app_match_players a
    WHERE a.match_id=m.id AND a.player_id=v_player AND a.selection_status IN('starter','bench'))) OR
  (v_secondary IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.app_match_players a
    WHERE a.match_id=m.id AND a.player_id=v_secondary AND a.selection_status IN('starter','bench')))
 ) THEN RAISE EXCEPTION 'Giocatore non convocato';END IF;
 IF v_type='substitution' AND (v_side<>'team' OR v_player IS NULL OR v_player IS NOT DISTINCT FROM v_secondary)
 THEN RAISE EXCEPTION 'Sostituzione: uscente obbligatorio, entrante diverso o assente';END IF;
 IF v_type IN('yellow_card','red_card','blue_card','blue_return') AND v_side='team' AND v_player IS NULL THEN
  RAISE EXCEPTION 'Indica il giocatore per la disciplina';END IF;
 IF v_type<>'substitution' THEN v_reason:=NULL;
 ELSIF v_reason IS NOT NULL AND v_reason NOT IN
 ('tactical','technical','other','technical_choice','injury_prevention',
  'disciplinary_prevention','injury','standing_ovation','give_teammates_time') THEN
  RAISE EXCEPTION 'Motivo sostituzione non valido';
 END IF;
 v_before:=to_jsonb(e);
 v_payload:=jsonb_set(coalesce(e.payload,'{}'::jsonb),'{notes}',to_jsonb(v_notes),true);
 UPDATE public.app_match_events SET event_type=v_type,team_side=v_side,
  player_id=v_player,secondary_player_id=v_secondary,
  minute=v_minute,stoppage_minute=v_stoppage,substitution_reason=v_reason,
  payload=v_payload,validation_status='proposed',officialized_by=NULL,officialized_at=NULL
 WHERE id=e.id RETURNING to_jsonb(app_match_events.*) INTO v_after;
 INSERT INTO public.tm_app_event_revisions(match_id,event_id,editor_id,reason,previous_record,next_record,created_at)
 VALUES(m.id,e.id,auth.uid(),btrim(p_reason),v_before,v_after,v_now);
 RETURN jsonb_build_object('match_id',m.id,'event_id',e.id,'status','proposed','revision_recorded',true);
END $function$
;

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

DROP TRIGGER IF EXISTS tm_app_review_reset_match ON public.app_matches;
CREATE TRIGGER tm_app_review_reset_match BEFORE UPDATE ON public.app_matches FOR EACH ROW EXECUTE FUNCTION public.tm_app_review_reset_match();
DROP TRIGGER IF EXISTS tm_app_review_reset_fixture ON public.app_competition_fixtures;
CREATE TRIGGER tm_app_review_reset_fixture AFTER UPDATE ON public.app_competition_fixtures FOR EACH ROW EXECUTE FUNCTION public.tm_app_review_reset_fixture();
DROP TRIGGER IF EXISTS tm_app_review_reset_event ON public.app_match_events;
CREATE TRIGGER tm_app_review_reset_event AFTER INSERT OR UPDATE OR DELETE ON public.app_match_events FOR EACH ROW EXECUTE FUNCTION public.tm_app_review_reset_event();
REVOKE ALL ON FUNCTION public.tm_app_amend_event(uuid,uuid,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_amend_event(uuid,uuid,text,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_review_result(uuid,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_review_result(uuid,text,integer,integer) TO authenticated;
