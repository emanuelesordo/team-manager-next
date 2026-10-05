-- Use the real first-half end as a stronger calibration point and estimate 2T at +15 minutes.
CREATE OR REPLACE FUNCTION public.tm_app_match_time_anchor_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz:=clock_timestamp();
  v_len integer:=0;
  v_end timestamptz;
  v_derived_start timestamptz;
BEGIN
  SELECT coalesce(minutes_per_period,0) INTO v_len
  FROM public.app_competitions WHERE id=NEW.competition_id;

  IF OLD.live_period IS DISTINCT FROM NEW.live_period THEN
    IF NEW.live_period='halftime' AND OLD.live_period='first_half' THEN
      v_end:=v_now;
      v_derived_start:=v_end-make_interval(mins=>v_len);

      INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
      VALUES(NEW.id,'first_half','period_end',v_end,false,'period_end_action',auth.uid());

      INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
      VALUES(NEW.id,'first_half','period_start',v_derived_start,true,'period_end_derived',auth.uid(),
             jsonb_build_object('derived_from','halftime_action','assumed_stoppage',0));

      INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
      VALUES(NEW.id,'second_half','period_start',v_end+interval '15 minutes',true,'halftime_plus_15',auth.uid());

      PERFORM private.tm_app_recalibrate_estimated_events(NEW.id,'first_half');

    ELSIF NEW.live_period='second_half' THEN
      UPDATE public.app_matches
      SET live_period_started_at=v_now,live_period_start_estimated=false,live_clock_estimated=false
      WHERE id=NEW.id;

      INSERT INTO public.tm_app_match_time_anchors(match_id,period,anchor_kind,anchor_at,is_estimated,source,created_by)
      VALUES(NEW.id,'second_half','period_start',v_now,false,'period_start_action',auth.uid());

      PERFORM private.tm_app_recalibrate_estimated_events(NEW.id,'second_half');
    END IF;
  END IF;
  RETURN NULL;
END
$function$

