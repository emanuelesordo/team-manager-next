-- Deployed 2026-10-05. An open negative report keeps the event disputed until an amendment clears it.
CREATE OR REPLACE FUNCTION public.tm_app_react_event(
  p_match_id uuid,
  p_event_id uuid,
  p_reaction smallint,
  p_note text DEFAULT NULL,
  p_proposed_changes jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_role text;
  e public.app_match_events%ROWTYPE;
  v_pos integer;
  v_neg integer;
  v_status text;
  v_has_open_dispute boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
  SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
  IF coalesce(v_role,'') NOT IN ('admin','player') THEN
    RAISE EXCEPTION 'Solo giocatori e amministratori possono validare gli eventi';
  END IF;
  IF p_reaction NOT IN (-1,1) THEN RAISE EXCEPTION 'Reazione non valida'; END IF;
  IF length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Nota troppo lunga'; END IF;
  IF p_reaction=-1 AND coalesce(nullif(btrim(p_note),''),NULL) IS NULL
     AND (p_proposed_changes IS NULL OR p_proposed_changes='{}'::jsonb) THEN
    RAISE EXCEPTION 'Indica cosa deve essere corretto';
  END IF;

  SELECT * INTO e FROM public.app_match_events
  WHERE id=p_event_id AND match_id=p_match_id FOR UPDATE;
  IF NOT FOUND OR e.validation_status='rejected' THEN RAISE EXCEPTION 'Evento non disponibile'; END IF;

  v_has_open_dispute:=e.validation_status='disputed'
    AND nullif(btrim(coalesce(e.payload->>'dispute_note','')),'') IS NOT NULL;

  INSERT INTO public.tm_app_event_reactions(event_id,user_id,reaction,proposed_changes,note,created_at,updated_at)
  VALUES(e.id,v_uid,p_reaction,coalesce(p_proposed_changes,'{}'::jsonb),nullif(btrim(p_note),''),clock_timestamp(),clock_timestamp())
  ON CONFLICT(event_id,user_id) DO UPDATE
  SET reaction=excluded.reaction,proposed_changes=excluded.proposed_changes,note=excluded.note,updated_at=clock_timestamp();

  SELECT count(*) FILTER(WHERE reaction=1),count(*) FILTER(WHERE reaction=-1)
  INTO v_pos,v_neg FROM public.tm_app_event_reactions WHERE event_id=e.id;

  IF p_reaction=-1 OR v_neg>0 OR v_has_open_dispute THEN
    v_status:='disputed';
    UPDATE public.app_match_events
    SET validation_status=v_status,officialized_by=NULL,officialized_at=NULL,
        support_count=v_pos,dispute_count=v_neg,
        payload=CASE WHEN p_reaction=-1
          THEN jsonb_set(coalesce(payload,'{}'::jsonb),'{dispute_note}',to_jsonb(nullif(btrim(p_note),'')),true)
          ELSE payload END
    WHERE id=e.id;
  ELSE
    v_status:=CASE WHEN e.minute IS NOT NULL AND e.timing_consistent IS TRUE
                   THEN 'official' ELSE 'community_confirmed' END;
    UPDATE public.app_match_events
    SET validation_status=v_status,
        officialized_by=CASE WHEN v_status='official' THEN v_uid ELSE NULL END,
        officialized_at=CASE WHEN v_status='official' THEN clock_timestamp() ELSE NULL END,
        support_count=v_pos,dispute_count=v_neg
    WHERE id=e.id;
    IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(e.id); END IF;
  END IF;

  RETURN jsonb_build_object(
    'event_id',e.id,'status',v_status,'support_count',v_pos,'dispute_count',v_neg,
    'requires_management',v_status IN ('community_confirmed','disputed')
  );
END
$function$;

REVOKE ALL ON FUNCTION public.tm_app_react_event(uuid,uuid,smallint,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_react_event(uuid,uuid,smallint,text,jsonb) TO authenticated;
