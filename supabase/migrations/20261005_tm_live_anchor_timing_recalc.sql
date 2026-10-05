-- Recalculate timing against per-period anchors.
CREATE OR REPLACE FUNCTION public.tm_app_event_recalc_timing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;
  f public.app_competition_fixtures%ROWTYPE;
  v_anchor timestamptz;
  v_offset integer;
BEGIN
  IF NEW.captured_at IS NULL THEN NEW.captured_at:=coalesce(NEW.created_at,clock_timestamp()); END IF;

  IF OLD.minute IS DISTINCT FROM NEW.minute
     AND coalesce(NEW.payload->>'minute_origin','')<>'live_estimated' THEN
    NEW.payload:=jsonb_set(
      jsonb_set(coalesce(NEW.payload,'{}'::jsonb),'{minute_provisional}','false'::jsonb,true),
      '{minute_origin}',to_jsonb('reviewed_manual'::text),true
    );
  END IF;

  IF NEW.minute IS NULL THEN
    NEW.expected_at:=NULL;
    NEW.timing_delta_seconds:=NULL;
    NEW.timing_consistent:=NULL;
    NEW.payload:=coalesce(NEW.payload,'{}'::jsonb)||jsonb_build_object(
      'minute_missing',true,'expected_at',NULL,'timing_delta_seconds',NULL,'timing_consistent',NULL
    );
    RETURN NEW;
  END IF;

  SELECT * INTO m FROM public.app_matches WHERE id=NEW.match_id;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id;

  v_offset:=coalesce(private.tm_app_period_offset(NEW.match_id,coalesce(NEW.payload->>'period',m.live_period)),0);
  v_anchor:=private.tm_app_best_period_anchor(NEW.match_id,coalesce(NEW.payload->>'period',m.live_period));
  IF v_anchor IS NULL THEN
    v_anchor:=coalesce(m.live_started_at,f.kickoff_at);
    IF coalesce(NEW.payload->>'period',m.live_period)='second_half' THEN
      v_anchor:=v_anchor+make_interval(mins=>coalesce((SELECT minutes_per_period FROM public.app_competitions WHERE id=m.competition_id),0)+15);
    END IF;
  END IF;
  IF v_anchor IS NULL THEN RETURN NEW; END IF;

  NEW.expected_at:=v_anchor+make_interval(mins=>greatest(0,NEW.minute-v_offset)+coalesce(NEW.stoppage_minute,0));
  NEW.timing_delta_seconds:=round(extract(epoch from (NEW.captured_at-NEW.expected_at)))::integer;
  NEW.timing_consistent:=abs(NEW.timing_delta_seconds)<=300;
  NEW.payload:=coalesce(NEW.payload,'{}'::jsonb)||jsonb_build_object(
    'expected_at',NEW.expected_at,'timing_delta_seconds',NEW.timing_delta_seconds,
    'timing_consistent',NEW.timing_consistent,'timing_tolerance_seconds',300,'minute_missing',false
  );
  RETURN NEW;
END
$function$

