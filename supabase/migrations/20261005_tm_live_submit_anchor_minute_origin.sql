-- Anchor-aware live event submission with explicit minute origin.
CREATE OR REPLACE FUNCTION public.tm_app_submit_live_event(p_match_id uuid,p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE;
  v_uid uuid:=auth.uid();v_role text;v_trusted boolean:=false;v_type text;v_side text;
  v_player uuid;v_secondary uuid;v_minute integer;v_stoppage integer;v_reason text;v_notes text;
  v_count_score boolean;v_request_key text;v_minute_mode text;v_minute_origin text;
  v_now timestamptz:=clock_timestamp();v_captured timestamptz;v_anchor timestamptz;v_offset integer:=0;
  v_expected timestamptz;v_delta integer;v_consistent boolean;v_estimated boolean:=false;v_status text;v_payload jsonb;v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Tabellino non collegato'; END IF;
 SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
 IF m.status NOT IN ('scheduled','live') THEN RAISE EXCEPTION 'Inserimento live non disponibile nello stato attuale'; END IF;
 SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;v_role:=coalesce(v_role,'fan');v_trusted:=v_role IN ('admin','player');
 v_type:=nullif(p_event->>'event_type','');v_side:=coalesce(nullif(p_event->>'team_side',''),'team');
 IF v_type NOT IN ('goal','own_goal','penalty_scored','penalty_missed','yellow_card','blue_card','blue_return','red_card','substitution','period_end','other','assist') THEN RAISE EXCEPTION 'Tipo evento non valido'; END IF;
 IF v_side NOT IN ('team','opponent') THEN RAISE EXCEPTION 'Squadra evento non valida'; END IF;
 v_player:=nullif(p_event->>'player_id','')::uuid;v_secondary:=nullif(p_event->>'secondary_player_id','')::uuid;
 v_minute:=nullif(p_event->>'minute','')::integer;v_stoppage:=nullif(p_event->>'stoppage_minute','')::integer;
 v_reason:=nullif(p_event->>'substitution_reason','');v_notes:=left(coalesce(p_event->>'notes',''),400);
 v_count_score:=coalesce((p_event->>'count_score')::boolean,true);v_request_key:=nullif(p_event->>'request_key','');
 v_minute_mode:=coalesce(nullif(p_event->>'minute_mode',''),'now_estimated');
 v_minute_origin:=coalesce(nullif(p_event->>'minute_origin',''),CASE WHEN v_minute IS NULL THEN CASE WHEN v_minute_mode='past_unknown' THEN 'past_unknown' ELSE 'live_estimated' END ELSE 'manual' END);
 IF v_minute_origin NOT IN ('timer','manual','live_estimated','past_unknown') THEN v_minute_origin:='manual'; END IF;
 IF v_side='opponent' THEN v_player:=NULL;v_secondary:=NULL; END IF;
 v_captured:=coalesce(nullif(p_event->>'captured_at','')::timestamptz,v_now);
 IF abs(extract(epoch from(v_now-v_captured)))>1800 THEN RAISE EXCEPTION 'Timestamp evento troppo distante dall’invio'; END IF;
 IF v_request_key IS NOT NULL THEN SELECT id INTO v_id FROM public.app_match_events WHERE match_id=m.id AND proposed_by=v_uid AND payload->>'request_key'=v_request_key LIMIT 1;IF v_id IS NOT NULL THEN RETURN jsonb_build_object('event_id',v_id,'duplicate',true);END IF;END IF;
 v_anchor:=private.tm_app_best_period_anchor(m.id,m.live_period);v_offset:=coalesce(private.tm_app_period_offset(m.id,m.live_period),0);
 IF v_anchor IS NULL THEN
   v_anchor:=coalesce(m.live_period_started_at,m.live_started_at,f.kickoff_at);
   IF m.live_period='second_half' AND m.live_period_started_at IS NULL THEN
     v_anchor:=coalesce(m.live_started_at,f.kickoff_at)+make_interval(mins=>coalesce((SELECT minutes_per_period FROM public.app_competitions WHERE id=m.competition_id),0)+15);
   END IF;
 END IF;
 IF v_minute IS NULL AND v_minute_mode='now_estimated' AND v_anchor IS NOT NULL THEN
   v_minute:=v_offset+greatest(0,floor(extract(epoch from(v_captured-v_anchor))/60)::integer);v_estimated:=true;v_minute_origin:='live_estimated';
 ELSIF v_minute IS NOT NULL AND v_minute_origin='timer' AND coalesce(m.live_clock_estimated,false) THEN v_estimated:=true;v_minute_origin:='live_estimated';END IF;
 IF v_minute IS NOT NULL AND v_anchor IS NOT NULL THEN
   v_expected:=v_anchor+make_interval(mins=>greatest(0,v_minute-v_offset)+coalesce(v_stoppage,0));
   v_delta:=round(extract(epoch from(v_captured-v_expected)))::integer;v_consistent:=abs(v_delta)<=300;
 END IF;
 v_status:=CASE WHEN NOT v_trusted THEN 'proposed' WHEN v_estimated THEN 'official' WHEN v_minute IS NULL THEN 'proposed' WHEN v_consistent IS TRUE THEN 'official' ELSE 'proposed' END;
 v_payload:=coalesce(p_event->'payload','{}'::jsonb)||jsonb_build_object('entered_from','tm_app_live','request_key',v_request_key,'count_score',v_count_score,'counted_in_score',false,'score_applied',false,'period',m.live_period,'captured_at',v_captured,'received_at',v_now,'expected_at',v_expected,'timing_delta_seconds',v_delta,'timing_consistent',v_consistent,'timing_tolerance_seconds',300,'minute_missing',v_minute IS NULL,'minute_mode',v_minute_mode,'minute_provisional',v_estimated,'minute_origin',v_minute_origin,'submitted_role',v_role,'notes',v_notes);
 INSERT INTO public.app_match_events(match_id,fixture_id,event_type,minute,stoppage_minute,player_id,secondary_player_id,payload,proposed_by,validation_status,officialized_by,officialized_at,team_side,substitution_reason,source,source_raw,captured_at,expected_at,timing_delta_seconds,timing_consistent)
 VALUES(m.id,m.fixture_id,v_type,v_minute,v_stoppage,v_player,v_secondary,v_payload,v_uid,v_status,CASE WHEN v_status='official' THEN v_uid END,CASE WHEN v_status='official' THEN v_now END,v_side,v_reason,'live_user','{}'::jsonb,v_captured,v_expected,v_delta,v_consistent)
 RETURNING id INTO v_id;
 INSERT INTO public.tm_app_event_reports(event_id,user_id,captured_at,submitted,merged) VALUES(v_id,v_uid,v_captured,p_event,false) ON CONFLICT(event_id,user_id) DO NOTHING;
 IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(v_id);END IF;
 RETURN jsonb_build_object('event_id',v_id,'status',v_status,'timing_consistent',v_consistent,'timing_delta_seconds',v_delta,'minute',v_minute,'minute_provisional',v_estimated,'minute_origin',v_minute_origin,'requires_management',v_status<>'official');
END
$function$;
REVOKE ALL ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) TO authenticated;
