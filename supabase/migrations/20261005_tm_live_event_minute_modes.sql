-- Deployed 2026-10-05. Distinguish unknown past events from current events estimated from kickoff time.
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
  v_minute_mode text;
  v_now timestamptz:=clock_timestamp();
  v_captured timestamptz;
  v_kickoff timestamptz;
  v_expected timestamptz;
  v_delta integer;
  v_consistent boolean;
  v_estimated boolean:=false;
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
  v_minute_mode:=coalesce(nullif(p_event->>'minute_mode',''),'now_estimated');
  IF v_minute_mode NOT IN ('now_estimated','past_unknown') THEN v_minute_mode:='now_estimated'; END IF;

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

  IF v_minute IS NULL AND v_minute_mode='now_estimated' AND v_kickoff IS NOT NULL THEN
    v_minute:=greatest(0,floor(extract(epoch from (v_captured-v_kickoff))/60)::integer);
    v_estimated:=true;
  END IF;

  IF v_minute IS NOT NULL AND v_kickoff IS NOT NULL THEN
    v_expected:=v_kickoff+make_interval(mins=>v_minute+coalesce(v_stoppage,0));
    v_delta:=round(extract(epoch from (v_captured-v_expected)))::integer;
    v_consistent:=abs(v_delta)<=300;
  ELSE
    v_expected:=NULL;v_delta:=NULL;v_consistent:=NULL;
  END IF;

  v_status:=CASE
    WHEN NOT v_trusted THEN 'proposed'
    WHEN v_estimated THEN 'official'
    WHEN v_minute IS NULL THEN 'proposed'
    WHEN v_consistent IS TRUE THEN 'official'
    ELSE 'proposed'
  END;

  v_payload:=CASE WHEN jsonb_typeof(p_event->'payload')='object' THEN p_event->'payload' ELSE '{}'::jsonb END;
  v_payload:=v_payload||jsonb_build_object(
    'entered_from','tm_app_live','request_key',v_request_key,'count_score',v_count_score,
    'counted_in_score',false,'score_applied',false,'period',m.live_period,
    'captured_at',v_captured,'received_at',v_now,'expected_at',v_expected,
    'timing_delta_seconds',v_delta,'timing_consistent',v_consistent,
    'timing_tolerance_seconds',300,'minute_missing',v_minute IS NULL,
    'minute_mode',v_minute_mode,'minute_provisional',v_estimated,
    'minute_origin',CASE WHEN v_estimated THEN 'kickoff_estimate'
                         WHEN v_minute IS NULL THEN 'past_unknown'
                         ELSE 'manual_or_timer' END,
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
    'timing_delta_seconds',v_delta,'minute',v_minute,'minute_provisional',v_estimated,
    'requires_management',v_status<>'official'
  );
END
$function$;

REVOKE ALL ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) TO authenticated;
