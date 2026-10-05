-- Live temporal anchors, delayed-start support and duplicate-event merge infrastructure.
ALTER TABLE public.app_matches
  ADD COLUMN IF NOT EXISTS live_clock_estimated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_period_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_period_start_estimated boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tm_app_match_time_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.app_matches(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('first_half','second_half','extra','penalties')),
  anchor_kind text NOT NULL CHECK (anchor_kind IN ('period_start','period_end','pause','resume')),
  anchor_at timestamptz NOT NULL,
  is_estimated boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'live',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS tm_app_match_time_anchors_match_idx ON public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at);

CREATE TABLE IF NOT EXISTS public.tm_app_event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.app_match_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  captured_at timestamptz NOT NULL,
  submitted jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS tm_app_event_reports_event_idx ON public.tm_app_event_reports(event_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS tm_app_event_reports_user_event_unique ON public.tm_app_event_reports(event_id,user_id);
ALTER TABLE public.tm_app_match_time_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tm_app_event_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_app_match_time_anchors FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.tm_app_event_reports FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tm_app_period_offset(p_match_id uuid,p_period text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT CASE WHEN p_period='second_half' THEN coalesce(c.minutes_per_period,0)
             WHEN p_period='extra' THEN coalesce(c.minutes_per_period,0)*2 ELSE 0 END
 FROM public.app_matches m LEFT JOIN public.app_competitions c ON c.id=m.competition_id
 WHERE m.id=p_match_id
$function$;

CREATE OR REPLACE FUNCTION private.tm_app_best_period_anchor(p_match_id uuid,p_period text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT a.anchor_at
 FROM public.tm_app_match_time_anchors a
 WHERE a.match_id=p_match_id AND a.period=p_period AND a.anchor_kind='period_start'
 ORDER BY a.is_estimated ASC,
          CASE a.source WHEN 'operator_realtime' THEN 0 WHEN 'period_start_action' THEN 1 WHEN 'period_end_derived' THEN 2 ELSE 3 END,
          a.created_at DESC
 LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION private.tm_app_recalibrate_estimated_events(p_match_id uuid,p_period text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_anchor timestamptz;v_offset integer;v_count integer:=0;
BEGIN
 v_anchor:=private.tm_app_best_period_anchor(p_match_id,p_period);
 IF v_anchor IS NULL THEN RETURN 0; END IF;
 v_offset:=coalesce(private.tm_app_period_offset(p_match_id,p_period),0);
 UPDATE public.app_match_events e
 SET minute=v_offset+greatest(0,floor(extract(epoch from (e.captured_at-v_anchor))/60)::integer),
     payload=coalesce(e.payload,'{}'::jsonb)||jsonb_build_object(
       'minute_provisional',true,'minute_origin','live_estimated',
       'recalibrated_at',clock_timestamp(),'recalibrated_from_anchor',v_anchor)
 WHERE e.match_id=p_match_id
   AND coalesce(e.payload->>'period','')=p_period
   AND coalesce(e.payload->>'minute_origin','')='live_estimated'
   AND e.captured_at IS NOT NULL;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_event_clear_reactions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF OLD.event_type IS DISTINCT FROM NEW.event_type
    OR OLD.minute IS DISTINCT FROM NEW.minute
    OR OLD.stoppage_minute IS DISTINCT FROM NEW.stoppage_minute
    OR OLD.player_id IS DISTINCT FROM NEW.player_id
    OR OLD.secondary_player_id IS DISTINCT FROM NEW.secondary_player_id
    OR OLD.team_side IS DISTINCT FROM NEW.team_side
    OR OLD.substitution_reason IS DISTINCT FROM NEW.substitution_reason THEN
   IF OLD.minute IS DISTINCT FROM NEW.minute
      AND coalesce(OLD.payload->>'minute_origin','')='live_estimated'
      AND coalesce(NEW.payload->>'minute_origin','')='live_estimated'
      AND OLD.event_type IS NOT DISTINCT FROM NEW.event_type
      AND OLD.stoppage_minute IS NOT DISTINCT FROM NEW.stoppage_minute
      AND OLD.player_id IS NOT DISTINCT FROM NEW.player_id
      AND OLD.secondary_player_id IS NOT DISTINCT FROM NEW.secondary_player_id
      AND OLD.team_side IS NOT DISTINCT FROM NEW.team_side
      AND OLD.substitution_reason IS NOT DISTINCT FROM NEW.substitution_reason THEN RETURN NULL;
   END IF;
   DELETE FROM public.tm_app_event_reactions WHERE event_id=NEW.id;
   UPDATE public.app_match_events
   SET support_count=0,dispute_count=0,payload=coalesce(payload,'{}'::jsonb)-'dispute_note'
   WHERE id=NEW.id;
 END IF;
 RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_start_live_v2(p_match_id uuid,p_mode text DEFAULT 'realtime',p_period text DEFAULT 'first_half',p_approx_minute integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE;c public.app_competitions%ROWTYPE;
 v_now timestamptz:=clock_timestamp();v_period_start timestamptz;v_first_start timestamptz;v_offset integer:=0;v_roster integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
 IF p_mode NOT IN ('realtime','delayed') THEN RAISE EXCEPTION 'Modalità avvio non valida'; END IF;
 IF p_period NOT IN ('first_half','second_half') THEN RAISE EXCEPTION 'Periodo iniziale non valido'; END IF;
 IF p_approx_minute<0 OR p_approx_minute>180 THEN RAISE EXCEPTION 'Minuto approssimativo non valido'; END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Partita non collegata'; END IF;
 IF m.status<>'scheduled' THEN RAISE EXCEPTION 'Partita già avviata o terminata'; END IF;
 SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
 SELECT * INTO c FROM public.app_competitions WHERE id=m.competition_id;
 SELECT count(*) INTO v_roster FROM public.app_match_players WHERE match_id=m.id AND started;
 IF v_roster<>11 THEN RAISE EXCEPTION 'Prima del live servono 11 titolari (attualmente %)',v_roster; END IF;
 IF p_mode='realtime' THEN p_period:='first_half';p_approx_minute:=0;v_period_start:=v_now;v_first_start:=v_now;
 ELSE
   v_period_start:=v_now-make_interval(mins=>p_approx_minute);
   IF p_period='second_half' THEN
     v_first_start:=v_period_start-make_interval(mins=>coalesce(c.minutes_per_period,0)+15);
     v_offset:=coalesce(c.minutes_per_period,0);
   ELSE v_first_start:=v_period_start; END IF;
 END IF;
 UPDATE public.app_matches
 SET status='live',live_period=p_period,live_started_at=v_first_start,live_period_started_at=v_period_start,
     live_period_start_estimated=(p_mode='delayed'),live_clock_estimated=(p_mode='delayed'),
     live_clock_seconds=(v_offset+p_approx_minute)*60,live_clock_anchor=v_now,live_clock_running=true,
     home_score=coalesce(home_score,0),away_score=coalesce(away_score,0)
 WHERE id=m.id;
 UPDATE public.app_competition_fixtures SET status='live',home_score=coalesce(home_score,0),away_score=coalesce(away_score,0) WHERE id=f.id;
 INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
 VALUES(m.id,p_period,'period_start',v_period_start,p_mode='delayed',
        CASE WHEN p_mode='realtime' THEN 'operator_realtime' ELSE 'operator_delayed' END,auth.uid(),
        jsonb_build_object('approx_minute',p_approx_minute));
 IF p_period='second_half' THEN
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(m.id,'first_half','period_start',v_first_start,true,'derived_from_delayed_second_half',auth.uid());
 END IF;
 RETURN jsonb_build_object('match_id',m.id,'mode',p_mode,'period',p_period,'approx_minute',p_approx_minute,'period_started_at',v_period_start,'clock_estimated',p_mode='delayed');
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_match_time_anchor_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_now timestamptz:=clock_timestamp();v_end timestamptz;
BEGIN
 IF OLD.live_period IS DISTINCT FROM NEW.live_period THEN
  IF NEW.live_period='halftime' AND OLD.live_period='first_half' THEN
   v_end:=v_now;
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(NEW.id,'first_half','period_end',v_end,false,'period_end_action',auth.uid());
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(NEW.id,'second_half','period_start',v_end+interval '15 minutes',true,'halftime_plus_15',auth.uid());
   PERFORM private.tm_app_recalibrate_estimated_events(NEW.id,'first_half');
  ELSIF NEW.live_period='second_half' THEN
   UPDATE public.app_matches SET live_period_started_at=v_now,live_period_start_estimated=false,live_clock_estimated=false WHERE id=NEW.id;
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(NEW.id,'second_half','period_start',v_now,false,'period_start_action',auth.uid());
   PERFORM private.tm_app_recalibrate_estimated_events(NEW.id,'second_half');
  END IF;
 END IF;
 RETURN NULL;
END
$function$;
DROP TRIGGER IF EXISTS tm_app_match_time_anchor_trigger ON public.app_matches;
CREATE TRIGGER tm_app_match_time_anchor_trigger AFTER UPDATE OF live_period ON public.app_matches
FOR EACH ROW EXECUTE FUNCTION public.tm_app_match_time_anchor_trigger();

CREATE OR REPLACE FUNCTION public.tm_app_period_end_anchor_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_period text;v_len integer:=0;v_end timestamptz;v_start timestamptz;
BEGIN
 IF NEW.event_type<>'period_end' OR NEW.validation_status='rejected' OR NEW.match_id IS NULL THEN RETURN NULL; END IF;
 v_period:=coalesce(NEW.payload->>'period','first_half');
 IF v_period NOT IN ('first_half','second_half') THEN RETURN NULL; END IF;
 SELECT coalesce(c.minutes_per_period,0) INTO v_len
 FROM public.app_matches m LEFT JOIN public.app_competitions c ON c.id=m.competition_id WHERE m.id=NEW.match_id;
 v_end:=coalesce(NEW.captured_at,NEW.created_at,clock_timestamp());
 v_start:=v_end-make_interval(mins=>v_len+coalesce(NEW.stoppage_minute,0));
 INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
 VALUES(NEW.match_id,v_period,'period_start',v_start,true,'period_end_derived',NEW.proposed_by,jsonb_build_object('from_event_id',NEW.id,'stoppage_minute',coalesce(NEW.stoppage_minute,0)));
 INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
 VALUES(NEW.match_id,v_period,'period_end',v_end,false,'period_end_event',NEW.proposed_by,jsonb_build_object('from_event_id',NEW.id));
 IF v_period='first_half' THEN
  INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
  VALUES(NEW.match_id,'second_half','period_start',v_end+interval '15 minutes',true,'halftime_plus_15',NEW.proposed_by,jsonb_build_object('from_event_id',NEW.id));
 END IF;
 PERFORM private.tm_app_recalibrate_estimated_events(NEW.match_id,v_period);
 RETURN NULL;
END
$function$;
DROP TRIGGER IF EXISTS tm_app_period_end_anchor_trigger ON public.app_match_events;
CREATE TRIGGER tm_app_period_end_anchor_trigger
AFTER INSERT OR UPDATE OF event_type,stoppage_minute,captured_at,validation_status ON public.app_match_events
FOR EACH ROW EXECUTE FUNCTION public.tm_app_period_end_anchor_trigger();

CREATE OR REPLACE FUNCTION public.tm_app_find_event_duplicate(p_match_id uuid,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid();v_type text:=nullif(p_event->>'event_type','');v_side text:=coalesce(nullif(p_event->>'team_side',''),'team');
 v_captured timestamptz:=clock_timestamp();e public.app_match_events%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 IF nullif(p_event->>'captured_at','') IS NOT NULL THEN BEGIN v_captured:=(p_event->>'captured_at')::timestamptz; EXCEPTION WHEN others THEN NULL; END; END IF;
 SELECT * INTO e FROM public.app_match_events x
 WHERE x.match_id=p_match_id AND x.validation_status<>'rejected' AND x.event_type=v_type AND x.team_side=v_side
   AND x.proposed_by IS DISTINCT FROM v_uid
   AND x.captured_at BETWEEN v_captured-interval '90 seconds' AND v_captured+interval '90 seconds'
 ORDER BY abs(extract(epoch from (x.captured_at-v_captured))) ASC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('candidate',false); END IF;
 RETURN jsonb_build_object('candidate',true,'event_id',e.id,'event_type',e.event_type,'team_side',e.team_side,
   'captured_at',e.captured_at,'minute',e.minute,'player_id',e.player_id,'secondary_player_id',e.secondary_player_id,
   'distance_seconds',abs(round(extract(epoch from (e.captured_at-v_captured)))::integer));
END
$function$;

REVOKE ALL ON FUNCTION public.tm_app_start_live_v2(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_start_live_v2(uuid,text,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_find_event_duplicate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_find_event_duplicate(uuid,jsonb) TO authenticated;
