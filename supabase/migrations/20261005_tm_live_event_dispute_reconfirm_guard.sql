-- Deployed 2026-10-05. A disputed event cannot be re-officialized until its data have been amended.
CREATE OR REPLACE FUNCTION public.tm_app_review_event(p_match_id uuid,p_event_id uuid,p_decision text,p_expected_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_match public.app_matches%ROWTYPE;
  v_event public.app_match_events%ROWTYPE;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Decisione non prevista'; END IF;
  IF p_expected_status NOT IN ('proposed','community_confirmed','disputed') THEN RAISE EXCEPTION 'Stato atteso non valido'; END IF;

  SELECT * INTO v_match FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.fixture_id IS NULL THEN RAISE EXCEPTION 'Tabellino non collegato'; END IF;
  IF v_match.status NOT IN ('live','finished') THEN RAISE EXCEPTION 'Revisione disponibile soltanto durante e dopo la partita'; END IF;

  SELECT * INTO v_event FROM public.app_match_events
  WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento non trovato nella partita'; END IF;
  IF v_event.validation_status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Evento modificato da un altro utente: aggiorna il tabellino prima di riprovare';
  END IF;

  IF p_decision='approve' AND v_event.validation_status='disputed'
     AND nullif(btrim(coalesce(v_event.payload->>'dispute_note','')),'') IS NOT NULL THEN
    RAISE EXCEPTION 'Evento contestato: rettifica i dati prima di riconfermare';
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

  RETURN jsonb_build_object(
    'event_id',p_event_id,'match_id',p_match_id,'status',v_status,
    'score_applied',v_status='official'
  );
END
$function$;

REVOKE ALL ON FUNCTION public.tm_app_review_event(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_review_event(uuid,uuid,text,text) TO authenticated;
