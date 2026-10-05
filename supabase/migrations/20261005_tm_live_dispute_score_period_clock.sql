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


CREATE OR REPLACE FUNCTION public.tm_app_react_event(p_match_id uuid,p_event_id uuid,p_reaction smallint,p_note text DEFAULT NULL,p_proposed_changes jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid();v_role text;e public.app_match_events%ROWTYPE;v_pos integer;v_neg integer;v_status text;v_has_open_dispute boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto';END IF;
 SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
 IF coalesce(v_role,'') NOT IN ('admin','player') THEN RAISE EXCEPTION 'Solo giocatori e amministratori possono validare gli eventi';END IF;
 IF p_reaction NOT IN (-1,1) THEN RAISE EXCEPTION 'Reazione non valida';END IF;
 IF p_reaction=-1 AND coalesce(nullif(btrim(p_note),''),NULL) IS NULL AND (p_proposed_changes IS NULL OR p_proposed_changes='{}'::jsonb) THEN RAISE EXCEPTION 'Indica cosa deve essere corretto';END IF;
 SELECT * INTO e FROM public.app_match_events WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;
 IF NOT FOUND OR e.validation_status='rejected' THEN RAISE EXCEPTION 'Evento non disponibile';END IF;
 v_has_open_dispute:=e.validation_status='disputed' AND nullif(btrim(coalesce(e.payload->>'dispute_note','')),'') IS NOT NULL;
 INSERT INTO public.tm_app_event_reactions(event_id,user_id,reaction,proposed_changes,note,created_at,updated_at)
 VALUES(e.id,v_uid,p_reaction,coalesce(p_proposed_changes,'{}'::jsonb),nullif(btrim(p_note),''),clock_timestamp(),clock_timestamp())
 ON CONFLICT(event_id,user_id) DO UPDATE SET reaction=excluded.reaction,proposed_changes=excluded.proposed_changes,note=excluded.note,updated_at=clock_timestamp();
 SELECT count(*) FILTER(WHERE reaction=1),count(*) FILTER(WHERE reaction=-1) INTO v_pos,v_neg FROM public.tm_app_event_reactions WHERE event_id=e.id;
 IF p_reaction=-1 OR v_neg>0 OR v_has_open_dispute THEN
   IF coalesce((e.payload->>'score_applied')::boolean,false) THEN PERFORM private.tm_app_remove_event_score(e.id);END IF;
   v_status:='disputed';
   UPDATE public.app_match_events SET validation_status=v_status,officialized_by=NULL,officialized_at=NULL,support_count=v_pos,dispute_count=v_neg,
     payload=CASE WHEN p_reaction=-1 THEN jsonb_set(coalesce(payload,'{}'::jsonb),'{dispute_note}',to_jsonb(nullif(btrim(p_note),'')),true) ELSE payload END
   WHERE id=e.id;
 ELSE
   v_status:=CASE WHEN e.minute IS NOT NULL AND (e.timing_consistent IS TRUE OR coalesce(e.payload->>'minute_provisional','false')::boolean) THEN 'official' ELSE 'community_confirmed' END;
   UPDATE public.app_match_events SET validation_status=v_status,officialized_by=CASE WHEN v_status='official' THEN v_uid END,officialized_at=CASE WHEN v_status='official' THEN clock_timestamp() END,support_count=v_pos,dispute_count=v_neg WHERE id=e.id;
   IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(e.id);END IF;
 END IF;
 RETURN jsonb_build_object('event_id',e.id,'status',v_status,'support_count',v_pos,'dispute_count',v_neg,'net_weight',v_pos-v_neg,'requires_management',v_status IN ('community_confirmed','disputed'));
END
$function$;
