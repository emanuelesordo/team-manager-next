-- Contested events leave the proposed score; period transitions reset the cumulative live clock correctly.
CREATE OR REPLACE FUNCTION private.tm_app_remove_event_score(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE e public.app_match_events%ROWTYPE;m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE;v_home boolean;
BEGIN
 SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR coalesce((e.payload->>'score_applied')::boolean,false)=false OR e.event_type NOT IN ('goal','own_goal','penalty_scored') THEN RETURN;END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=e.match_id FOR UPDATE;SELECT * INTO f FROM public.app_competition_fixtures WHERE id=e.fixture_id FOR UPDATE;
 v_home:=(m.home_away='home' AND e.team_side='team') OR (m.home_away='away' AND e.team_side='opponent');IF e.event_type='own_goal' THEN v_home:=NOT v_home;END IF;
 IF v_home THEN UPDATE public.app_matches SET home_score=greatest(0,home_score-1) WHERE id=m.id;UPDATE public.app_competition_fixtures SET home_score=greatest(0,home_score-1) WHERE id=f.id;
 ELSE UPDATE public.app_matches SET away_score=greatest(0,away_score-1) WHERE id=m.id;UPDATE public.app_competition_fixtures SET away_score=greatest(0,away_score-1) WHERE id=f.id;END IF;
 UPDATE public.app_match_events SET payload=jsonb_set(jsonb_set(payload,'{score_applied}','false'::jsonb,true),'{counted_in_score}','false'::jsonb,true) WHERE id=e.id;
END
$function$;

CREATE OR REPLACE FUNCTION public.tm_app_set_period_v2(p_match_id uuid,p_period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m public.app_matches%ROWTYPE;c public.app_competitions%ROWTYPE;v_now timestamptz:=clock_timestamp();v_seconds integer;v_running boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato';END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;IF NOT FOUND OR m.status<>'live' THEN RAISE EXCEPTION 'La partita non è in corso';END IF;
 SELECT * INTO c FROM public.app_competitions WHERE id=m.competition_id;
 IF p_period='halftime' THEN v_seconds:=coalesce(m.live_clock_seconds,0)+CASE WHEN m.live_clock_running AND m.live_clock_anchor IS NOT NULL THEN greatest(0,floor(extract(epoch from(v_now-m.live_clock_anchor)))::integer) ELSE 0 END;v_running:=false;
 ELSIF p_period='second_half' THEN v_seconds:=coalesce(c.minutes_per_period,0)*60;v_running:=true;
 ELSIF p_period='extra' THEN v_seconds:=coalesce(c.minutes_per_period,0)*2*60;v_running:=true;
 ELSIF p_period='penalties' THEN v_seconds:=coalesce(m.live_clock_seconds,0);v_running:=false;
 ELSE RAISE EXCEPTION 'Periodo non valido';END IF;
 UPDATE public.app_matches SET live_period=p_period,live_clock_seconds=v_seconds,live_clock_running=v_running,live_clock_anchor=CASE WHEN v_running THEN v_now END,live_clock_estimated=false WHERE id=m.id;
 RETURN jsonb_build_object('match_id',m.id,'period',p_period,'clock_seconds',v_seconds,'running',v_running);
END
$function$;
REVOKE ALL ON FUNCTION public.tm_app_set_period_v2(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_set_period_v2(uuid,text) TO authenticated;
