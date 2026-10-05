-- Deployed 2026-10-05. Live event trust, timestamp consistency and trusted reactions.

ALTER TABLE public.app_match_events
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_at timestamptz,
  ADD COLUMN IF NOT EXISTS timing_delta_seconds integer,
  ADD COLUMN IF NOT EXISTS timing_consistent boolean,
  ADD COLUMN IF NOT EXISTS support_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_count integer NOT NULL DEFAULT 0;

UPDATE public.app_match_events SET captured_at=created_at WHERE captured_at IS NULL;
ALTER TABLE public.app_match_events
  ALTER COLUMN captured_at SET DEFAULT now(),
  ALTER COLUMN captured_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.tm_app_event_reactions(
  event_id uuid NOT NULL REFERENCES public.app_match_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction smallint NOT NULL CHECK(reaction IN (-1,1)),
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id),
  CHECK(note IS NULL OR length(note)<=500)
);
ALTER TABLE public.tm_app_event_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_app_event_reactions FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tm_app_apply_event_score(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  e public.app_match_events%ROWTYPE;
  m public.app_matches%ROWTYPE;
  v_home boolean;
BEGIN
  SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR e.validation_status<>'official' THEN RETURN; END IF;
  IF e.event_type NOT IN ('goal','own_goal','penalty_scored') THEN RETURN; END IF;
  IF NOT coalesce((e.payload->>'count_score')::boolean,true) THEN RETURN; END IF;
  IF coalesce((e.payload->>'score_applied')::boolean,false) THEN RETURN; END IF;

  SELECT * INTO m FROM public.app_matches WHERE id=e.match_id FOR UPDATE;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RETURN; END IF;

  v_home := (m.home_away='home' AND e.team_side='team')
         OR (m.home_away='away' AND e.team_side='opponent');
  IF e.event_type='own_goal' THEN v_home:=NOT v_home; END IF;

  IF v_home THEN
    UPDATE public.app_competition_fixtures SET home_score=coalesce(home_score,0)+1 WHERE id=m.fixture_id;
    UPDATE public.app_matches SET home_score=coalesce(home_score,0)+1 WHERE id=m.id;
  ELSE
    UPDATE public.app_competition_fixtures SET away_score=coalesce(away_score,0)+1 WHERE id=m.fixture_id;
    UPDATE public.app_matches SET away_score=coalesce(away_score,0)+1 WHERE id=m.id;
  END IF;

  UPDATE public.app_match_events
  SET payload=jsonb_set(
      jsonb_set(coalesce(payload,'{}'::jsonb),'{score_applied}','true'::jsonb,true),
      '{counted_in_score}','true'::jsonb,true)
  WHERE id=e.id;
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_submit_live_event(p_match_id uuid,p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;
  f public.app_competition_fixtures%ROWTYPE;
  v_uid uuid:=auth.uid();
  v_role text;
  v_trusted boolean:=false;
  v_type text;
  v_side text;
  v_player uuid;
  v_secondary uuid;
  v_minute integer;
  v_stoppage integer;
  v_reason text;
  v_notes text;
  v_count_score boolean;
  v_request_key text;
  v_now timestamptz:=clock_timestamp();
  v_captured timestamptz;
  v_kickoff timestamptz;
  v_expected timestamptz;
  v_delta integer;
  v_consistent boolean;
  v_status text;
  v_payload jsonb;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
  IF p_event IS NULL OR jsonb_typeof(p_event)<>'object' THEN RAISE EXCEPTION 'Evento non valido'; END IF;

  SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Tabellino non collegato'; END IF;
  SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fixture non disponibile'; END IF;

  IF m.status NOT IN ('scheduled','live') THEN RAISE EXCEPTION 'Inserimento live non disponibile nello stato attuale'; END IF;
  IF m.status='scheduled' AND coalesce(m.live_started_at,f.kickoff_at) IS NOT NULL
     AND coalesce(m.live_started_at,f.kickoff_at)>v_now+interval '5 minutes' THEN
    RAISE EXCEPTION 'La partita non risulta ancora iniziata';
  END IF;

  SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
  v_role:=coalesce(v_role,'fan');
  v_trusted:=v_role IN ('admin','player');

  v_type:=nullif(p_event->>'event_type','');
  v_side:=coalesce(nullif(p_event->>'team_side',''),'team');
  IF v_type NOT IN ('goal','own_goal','penalty_scored','penalty_missed','yellow_card','blue_card','blue_return','red_card','substitution','period_end','other','assist') THEN
    RAISE EXCEPTION 'Tipo evento non valido';
  END IF;
  IF v_side NOT IN ('team','opponent') THEN RAISE EXCEPTION 'Squadra evento non valida'; END IF;

  v_player:=nullif(p_event->>'player_id','')::uuid;
  v_secondary:=nullif(p_event->>'secondary_player_id','')::uuid;
  v_minute:=nullif(p_event->>'minute','')::integer;
  v_stoppage:=nullif(p_event->>'stoppage_minute','')::integer;
  v_reason:=nullif(p_event->>'substitution_reason','');
  v_notes:=left(coalesce(p_event->>'notes',''),400);
  v_count_score:=coalesce((p_event->>'count_score')::boolean,true);
  v_request_key:=nullif(p_event->>'request_key','');

  IF v_minute IS NOT NULL AND (v_minute<0 OR v_minute>300) THEN RAISE EXCEPTION 'Minuto non valido'; END IF;
  IF v_stoppage IS NOT NULL AND (v_stoppage<0 OR v_stoppage>30) THEN RAISE EXCEPTION 'Recupero non valido'; END IF;
  IF v_side='opponent' THEN v_player:=NULL;v_secondary:=NULL; END IF;
  IF v_type='substitution' AND v_side='team' AND v_player IS NULL THEN RAISE EXCEPTION 'Indica il giocatore uscente'; END IF;
  IF v_type IN ('yellow_card','red_card','blue_card','blue_return') AND v_side='team' AND v_player IS NULL THEN
    RAISE EXCEPTION 'Indica il giocatore';
  END IF;

  IF v_player IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.app_match_players x WHERE x.match_id=m.id AND x.player_id=v_player
      AND x.selection_status IN ('starter','bench')
  ) THEN RAISE EXCEPTION 'Giocatore non convocato'; END IF;
  IF v_secondary IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.app_match_players x WHERE x.match_id=m.id AND x.player_id=v_secondary
      AND x.selection_status IN ('starter','bench')
  ) THEN RAISE EXCEPTION 'Giocatore secondario non convocato'; END IF;

  v_captured:=v_now;
  IF nullif(p_event->>'captured_at','') IS NOT NULL THEN
    BEGIN
      v_captured:=(p_event->>'captured_at')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Timestamp evento non valido';
    END;
    IF abs(extract(epoch from (v_now-v_captured)))>1800 THEN
      RAISE EXCEPTION 'Timestamp evento troppo distante dall’invio';
    END IF;
  END IF;

  IF v_request_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.app_match_events
    WHERE match_id=m.id AND proposed_by=v_uid AND payload->>'request_key'=v_request_key
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('event_id',v_id,'duplicate',true); END IF;
  END IF;

  v_kickoff:=coalesce(m.live_started_at,f.kickoff_at);
  IF v_minute IS NOT NULL AND v_kickoff IS NOT NULL THEN
    v_expected:=v_kickoff+make_interval(mins=>v_minute+coalesce(v_stoppage,0));
    v_delta:=round(extract(epoch from (v_captured-v_expected)))::integer;
    v_consistent:=abs(v_delta)<=300;
  ELSE
    v_expected:=NULL;v_delta:=NULL;v_consistent:=NULL;
  END IF;

  v_status:=CASE WHEN v_trusted AND v_minute IS NOT NULL AND v_consistent IS TRUE THEN 'official' ELSE 'proposed' END;
  v_payload:=CASE WHEN jsonb_typeof(p_event->'payload')='object' THEN p_event->'payload' ELSE '{}'::jsonb END;
  v_payload:=v_payload||jsonb_build_object(
    'entered_from','tm_app_live','request_key',v_request_key,'count_score',v_count_score,
    'counted_in_score',false,'score_applied',false,'period',m.live_period,
    'captured_at',v_captured,'received_at',v_now,'expected_at',v_expected,
    'timing_delta_seconds',v_delta,'timing_consistent',v_consistent,
    'timing_tolerance_seconds',300,'minute_missing',v_minute IS NULL,
    'submitted_role',v_role,'notes',v_notes
  );

  INSERT INTO public.app_match_events(
    match_id,fixture_id,event_type,minute,stoppage_minute,player_id,secondary_player_id,
    payload,proposed_by,validation_status,officialized_by,officialized_at,team_side,
    substitution_reason,source,source_raw,captured_at,expected_at,timing_delta_seconds,timing_consistent
  ) VALUES(
    m.id,m.fixture_id,v_type,v_minute,v_stoppage,v_player,v_secondary,v_payload,v_uid,v_status,
    CASE WHEN v_status='official' THEN v_uid ELSE NULL END,
    CASE WHEN v_status='official' THEN v_now ELSE NULL END,
    v_side,v_reason,'live_user','{}'::jsonb,v_captured,v_expected,v_delta,v_consistent
  ) RETURNING id INTO v_id;

  IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(v_id); END IF;

  RETURN jsonb_build_object(
    'event_id',v_id,'status',v_status,'timing_consistent',v_consistent,
    'timing_delta_seconds',v_delta,'requires_management',v_status<>'official'
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_react_event(
  p_match_id uuid,p_event_id uuid,p_reaction smallint,p_note text DEFAULT NULL,
  p_proposed_changes jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_role text;
  e public.app_match_events%ROWTYPE;
  v_pos integer;
  v_neg integer;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
  SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
  IF coalesce(v_role,'') NOT IN ('admin','player') THEN
    RAISE EXCEPTION 'Solo giocatori e amministratori possono validare gli eventi';
  END IF;
  IF p_reaction NOT IN (-1,1) THEN RAISE EXCEPTION 'Reazione non valida'; END IF;
  IF length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Nota troppo lunga'; END IF;
  IF p_reaction=-1 AND coalesce(nullif(btrim(p_note),''),NULL) IS NULL
     AND (p_proposed_changes IS NULL OR p_proposed_changes='{}'::jsonb) THEN
    RAISE EXCEPTION 'Indica cosa deve essere corretto';
  END IF;

  SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;
  IF NOT FOUND OR e.validation_status='rejected' THEN RAISE EXCEPTION 'Evento non disponibile'; END IF;

  INSERT INTO public.tm_app_event_reactions(event_id,user_id,reaction,proposed_changes,note,created_at,updated_at)
  VALUES(e.id,v_uid,p_reaction,coalesce(p_proposed_changes,'{}'::jsonb),nullif(btrim(p_note),''),clock_timestamp(),clock_timestamp())
  ON CONFLICT(event_id,user_id) DO UPDATE
  SET reaction=excluded.reaction,proposed_changes=excluded.proposed_changes,note=excluded.note,updated_at=clock_timestamp();

  SELECT count(*) FILTER(WHERE reaction=1),count(*) FILTER(WHERE reaction=-1)
  INTO v_pos,v_neg FROM public.tm_app_event_reactions WHERE event_id=e.id;

  IF p_reaction=-1 OR v_neg>0 THEN
    v_status:='disputed';
    UPDATE public.app_match_events
    SET validation_status=v_status,officialized_by=NULL,officialized_at=NULL,
        support_count=v_pos,dispute_count=v_neg,
        payload=jsonb_set(coalesce(payload,'{}'::jsonb),'{dispute_note}',to_jsonb(nullif(btrim(p_note),'')),true)
    WHERE id=e.id;
  ELSE
    v_status:=CASE WHEN e.minute IS NOT NULL AND e.timing_consistent IS TRUE THEN 'official' ELSE 'community_confirmed' END;
    UPDATE public.app_match_events
    SET validation_status=v_status,
        officialized_by=CASE WHEN v_status='official' THEN v_uid ELSE NULL END,
        officialized_at=CASE WHEN v_status='official' THEN clock_timestamp() ELSE NULL END,
        support_count=v_pos,dispute_count=v_neg
    WHERE id=e.id;
    IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(e.id); END IF;
  END IF;

  RETURN jsonb_build_object(
    'event_id',e.id,'status',v_status,'support_count',v_pos,'dispute_count',v_neg,
    'requires_management',v_status IN ('community_confirmed','disputed')
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_review_event(p_match_id uuid,p_event_id uuid,p_decision text,p_expected_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_match public.app_matches%ROWTYPE;v_event public.app_match_events%ROWTYPE;v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Decisione non prevista'; END IF;
  IF p_expected_status NOT IN ('proposed','community_confirmed','disputed') THEN RAISE EXCEPTION 'Stato atteso non valido'; END IF;
  SELECT * INTO v_match FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.fixture_id IS NULL THEN RAISE EXCEPTION 'Tabellino non collegato'; END IF;
  IF v_match.status NOT IN ('live','finished') THEN RAISE EXCEPTION 'Revisione disponibile soltanto durante e dopo la partita'; END IF;
  SELECT * INTO v_event FROM public.app_match_events WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento non trovato nella partita'; END IF;
  IF v_event.validation_status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Evento modificato da un altro utente: aggiorna il tabellino prima di riprovare';
  END IF;
  IF coalesce((v_event.payload->>'score_applied')::boolean,false) AND p_decision='reject' THEN
    RAISE EXCEPTION 'Evento già conteggiato nel risultato: rettifica prima il tabellone';
  END IF;
  v_status:=CASE WHEN p_decision='approve' THEN 'official' ELSE 'rejected' END;
  UPDATE public.app_match_events
  SET validation_status=v_status,
      officialized_by=CASE WHEN v_status='official' THEN auth.uid() ELSE NULL END,
      officialized_at=CASE WHEN v_status='official' THEN clock_timestamp() ELSE NULL END
  WHERE id=p_event_id AND match_id=p_match_id;
  IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(p_event_id); END IF;
  RETURN jsonb_build_object('event_id',p_event_id,'match_id',p_match_id,'status',v_status,'score_applied',v_status='official');
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_event_recalc_timing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE;v_kickoff timestamptz;
BEGIN
  IF NEW.captured_at IS NULL THEN NEW.captured_at:=coalesce(NEW.created_at,clock_timestamp()); END IF;
  IF NEW.minute IS NULL THEN
    NEW.expected_at:=NULL;NEW.timing_delta_seconds:=NULL;NEW.timing_consistent:=NULL;
    RETURN NEW;
  END IF;
  SELECT * INTO m FROM public.app_matches WHERE id=NEW.match_id;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id;
  v_kickoff:=coalesce(m.live_started_at,f.kickoff_at);
  IF v_kickoff IS NULL THEN RETURN NEW; END IF;
  NEW.expected_at:=v_kickoff+make_interval(mins=>NEW.minute+coalesce(NEW.stoppage_minute,0));
  NEW.timing_delta_seconds:=round(extract(epoch from (NEW.captured_at-NEW.expected_at)))::integer;
  NEW.timing_consistent:=abs(NEW.timing_delta_seconds)<=300;
  NEW.payload:=coalesce(NEW.payload,'{}'::jsonb)||jsonb_build_object(
    'expected_at',NEW.expected_at,'timing_delta_seconds',NEW.timing_delta_seconds,
    'timing_consistent',NEW.timing_consistent,'timing_tolerance_seconds',300,'minute_missing',false
  );
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS tm_app_event_recalc_timing ON public.app_match_events;
CREATE TRIGGER tm_app_event_recalc_timing
BEFORE UPDATE OF minute,stoppage_minute,captured_at ON public.app_match_events
FOR EACH ROW EXECUTE FUNCTION public.tm_app_event_recalc_timing();

CREATE OR REPLACE FUNCTION public.tm_app_event_clear_reactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.event_type IS DISTINCT FROM NEW.event_type
     OR OLD.minute IS DISTINCT FROM NEW.minute
     OR OLD.stoppage_minute IS DISTINCT FROM NEW.stoppage_minute
     OR OLD.player_id IS DISTINCT FROM NEW.player_id
     OR OLD.secondary_player_id IS DISTINCT FROM NEW.secondary_player_id
     OR OLD.team_side IS DISTINCT FROM NEW.team_side
     OR OLD.substitution_reason IS DISTINCT FROM NEW.substitution_reason THEN
    DELETE FROM public.tm_app_event_reactions WHERE event_id=NEW.id;
    UPDATE public.app_match_events
    SET support_count=0,dispute_count=0,payload=coalesce(payload,'{}'::jsonb)-'dispute_note'
    WHERE id=NEW.id;
  END IF;
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS tm_app_event_clear_reactions ON public.app_match_events;
CREATE TRIGGER tm_app_event_clear_reactions
AFTER UPDATE OF event_type,minute,stoppage_minute,player_id,secondary_player_id,team_side,substitution_reason
ON public.app_match_events
FOR EACH ROW EXECUTE FUNCTION public.tm_app_event_clear_reactions();

REVOKE ALL ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_react_event(uuid,uuid,smallint,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_react_event(uuid,uuid,smallint,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_review_event(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_review_event(uuid,uuid,text,text) TO authenticated;
