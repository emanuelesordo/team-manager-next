-- A merged report uses the earliest capture timestamp and re-runs provisional minute calibration.
CREATE OR REPLACE FUNCTION public.tm_app_merge_event_submission(p_match_id uuid,p_event_id uuid,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid();e public.app_match_events%ROWTYPE;v_captured timestamptz:=clock_timestamp();v_player uuid;v_secondary uuid;v_minute integer;v_origin text;v_conflicts jsonb:='{}'::jsonb;v_period text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto';END IF;
 SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;IF NOT FOUND OR e.validation_status='rejected' THEN RAISE EXCEPTION 'Evento da unificare non disponibile';END IF;
 IF e.event_type IS DISTINCT FROM p_event->>'event_type' OR e.team_side IS DISTINCT FROM coalesce(nullif(p_event->>'team_side',''),'team') THEN RAISE EXCEPTION 'Gli eventi non sono compatibili';END IF;
 IF nullif(p_event->>'captured_at','') IS NOT NULL THEN v_captured:=(p_event->>'captured_at')::timestamptz;END IF;
 IF abs(extract(epoch from(v_captured-e.captured_at)))>120 THEN RAISE EXCEPTION 'Gli eventi sono troppo distanti per essere unificati';END IF;
 v_player:=nullif(p_event->>'player_id','')::uuid;v_secondary:=nullif(p_event->>'secondary_player_id','')::uuid;v_minute:=nullif(p_event->>'minute','')::integer;v_origin:=coalesce(nullif(p_event->>'minute_origin',''),'manual');v_period:=coalesce(e.payload->>'period','first_half');
 IF e.player_id IS NOT NULL AND v_player IS NOT NULL AND e.player_id<>v_player THEN v_conflicts:=v_conflicts||jsonb_build_object('player_id',jsonb_build_array(e.player_id,v_player));END IF;
 IF e.secondary_player_id IS NOT NULL AND v_secondary IS NOT NULL AND e.secondary_player_id<>v_secondary THEN v_conflicts:=v_conflicts||jsonb_build_object('secondary_player_id',jsonb_build_array(e.secondary_player_id,v_secondary));END IF;
 IF e.minute IS NOT NULL AND v_minute IS NOT NULL AND e.minute<>v_minute AND coalesce(e.payload->>'minute_provisional','false')::boolean=false THEN v_conflicts:=v_conflicts||jsonb_build_object('minute',jsonb_build_array(e.minute,v_minute));END IF;
 INSERT INTO public.tm_app_event_reports(event_id,user_id,captured_at,submitted,merged) VALUES(e.id,v_uid,v_captured,p_event,true)
 ON CONFLICT(event_id,user_id) DO UPDATE SET captured_at=least(public.tm_app_event_reports.captured_at,excluded.captured_at),submitted=excluded.submitted,merged=true;
 UPDATE public.app_match_events
 SET captured_at=least(e.captured_at,v_captured),player_id=coalesce(e.player_id,v_player),secondary_player_id=coalesce(e.secondary_player_id,v_secondary),
     minute=CASE WHEN e.minute IS NULL THEN v_minute WHEN coalesce(e.payload->>'minute_provisional','false')::boolean AND v_minute IS NOT NULL AND v_origin IN ('timer','manual') THEN v_minute ELSE e.minute END,
     payload=coalesce(e.payload,'{}'::jsonb)||jsonb_build_object('merged_reports',coalesce((e.payload->>'merged_reports')::integer,0)+1,'merge_conflicts',coalesce(e.payload->'merge_conflicts','{}'::jsonb)||v_conflicts,'merged_last_at',clock_timestamp())
 WHERE id=e.id;
 IF coalesce(e.payload->>'minute_origin','')='live_estimated' THEN PERFORM private.tm_app_recalibrate_estimated_events(p_match_id,v_period);END IF;
 RETURN jsonb_build_object('event_id',e.id,'merged',true,'conflicts',v_conflicts,'captured_at',least(e.captured_at,v_captured));
END
$function$;
REVOKE ALL ON FUNCTION public.tm_app_merge_event_submission(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_merge_event_submission(uuid,uuid,jsonb) TO authenticated;
