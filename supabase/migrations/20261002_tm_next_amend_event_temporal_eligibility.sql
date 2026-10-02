-- Enforce time-dependent on-field eligibility after making revised event proposed (within same transaction).
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
 IF v_minute IS NOT NULL AND v_side='team' THEN
  IF v_player IS NOT NULL AND v_type IN
   ('goal','own_goal','penalty_scored','penalty_missed','substitution','assist')
   AND NOT public.tm_app_player_eligible(m.id,v_player,v_minute)
  THEN RAISE EXCEPTION 'Giocatore non in campo al minuto della rettifica';END IF;
  IF v_secondary IS NOT NULL AND v_type IN('goal','penalty_scored','assist')
   AND NOT public.tm_app_player_eligible(m.id,v_secondary,v_minute)
  THEN RAISE EXCEPTION 'Assistente non in campo al minuto della rettifica';END IF;
  IF v_secondary IS NOT NULL AND v_type='substitution'
   AND public.tm_app_player_eligible(m.id,v_secondary,v_minute)
  THEN RAISE EXCEPTION 'Il subentrante era già in campo al minuto indicato';END IF;
 END IF;
 INSERT INTO public.tm_app_event_revisions(match_id,event_id,editor_id,reason,previous_record,next_record,created_at)
 VALUES(m.id,e.id,auth.uid(),btrim(p_reason),v_before,v_after,v_now);
 RETURN jsonb_build_object('match_id',m.id,'event_id',e.id,'status','proposed','revision_recorded',true);
END $function$
;