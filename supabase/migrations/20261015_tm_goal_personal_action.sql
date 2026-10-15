-- Supporto alla dinamica gol: Azione personale.
CREATE OR REPLACE FUNCTION public.tm_app_set_event_details(p_match_id uuid, p_event_id uuid, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 e public.app_match_events%ROWTYPE;
 v_payload jsonb;
 v_before jsonb;
 v_after jsonb;
 g jsonb;
 point jsonb;
 field_name text;
 reason text;
 BEGIN
  IF auth.uid() IS NULL OR NOT private.is_staff() THEN
   RAISE EXCEPTION 'Operazione riservata allo staff'; END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details)<>'object' OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(p_details) AS k
          WHERE k NOT IN ('goal_details','disciplinary_reason','substitution_motivation')) THEN
   RAISE EXCEPTION 'Dettagli evento non validi'; END IF;
  SELECT e0.* INTO e
    FROM public.app_match_events e0 JOIN public.app_matches m ON m.id=e0.match_id
   WHERE e0.id=p_event_id AND e0.match_id=p_match_id AND m.fixture_id=e0.fixture_id
   FOR UPDATE OF e0;
  IF NOT FOUND OR e.validation_status='rejected' THEN RAISE EXCEPTION 'Evento Caselle non modificabile'; END IF;
  g:=p_details->'goal_details';
  IF g IS NOT NULL AND jsonb_typeof(g) NOT IN('object','null') THEN RAISE EXCEPTION 'Dati gol non validi'; END IF;
  IF jsonb_typeof(g)='object' THEN
   IF e.event_type NOT IN ('goal','own_goal','penalty_scored','penalty_goal') THEN RAISE EXCEPTION 'Dettagli gol su evento non gol'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(g) k
     WHERE k NOT IN('body_part','play_type','dynamics','shot','assist','distance_m','distance_zone')) THEN
    RAISE EXCEPTION 'Campo dettaglio gol sconosciuto'; END IF;
   IF g->>'body_part' IS NOT NULL AND g->>'body_part' NOT IN ('foot','knee','head') THEN RAISE EXCEPTION 'Parte corpo non valida'; END IF;
   IF g->>'play_type' IS NOT NULL AND g->>'play_type' NOT IN ('open_play','corner','penalty','free_kick') THEN RAISE EXCEPTION 'Tipo gol non valido'; END IF;
   IF g->>'dynamics' IS NOT NULL AND g->>'dynamics' NOT IN ('counterattack','cross','rebound','shot','scramble','tap_in','direct_free_kick','personal_action') THEN RAISE EXCEPTION 'Dinamica non valida'; END IF;
   IF g->>'distance_zone' IS NOT NULL AND g->>'distance_zone' NOT IN('goal_area','penalty_area','16_25','26_35','over_35') THEN RAISE EXCEPTION 'Fascia tiro non valida'; END IF;
   IF g->>'distance_m' IS NOT NULL AND
       (jsonb_typeof(g->'distance_m')<>'number' OR (g->>'distance_m')::numeric NOT BETWEEN 0 AND 125) THEN
    RAISE EXCEPTION 'Distanza tiro non valida'; END IF;
   FOREACH field_name IN ARRAY ARRAY['shot','assist'] LOOP
    point:=g->field_name;
    IF point IS NOT NULL AND jsonb_typeof(point) NOT IN ('null','object') THEN RAISE EXCEPTION 'Posizione non valida'; END IF;
    IF jsonb_typeof(point)='object' THEN
     IF jsonb_typeof(point->'x')<>'number' OR jsonb_typeof(point->'y')<>'number'
        OR (point->>'x')::numeric NOT BETWEEN 0 AND 68
        OR (point->>'y')::numeric NOT BETWEEN 0 AND 105 THEN
      RAISE EXCEPTION 'Coordinate non valide'; END IF;
    END IF;
   END LOOP;
  END IF;
  reason:=p_details->>'disciplinary_reason';
  IF reason IS NOT NULL AND (e.team_side<>'team' OR e.event_type NOT IN
   ('yellow_card','blue_card','red_card','second_yellow') OR reason NOT IN
   ('protest','foul','violent_conduct','unsporting','other')) THEN
    RAISE EXCEPTION 'Motivazione disciplinare non valida'; END IF;
  reason:=p_details->>'substitution_motivation';
  IF reason IS NOT NULL AND (e.team_side<>'team' OR e.event_type<>'substitution'
     OR reason NOT IN ('injury','physical_precaution','disciplinary_precaution','energy','technical_tactical')) THEN
    RAISE EXCEPTION 'Motivazione cambio non valida'; END IF;
  v_payload:=coalesce(e.payload,'{}'::jsonb)-'goal_details'-'disciplinary_reason'-'substitution_motivation' ||
    jsonb_strip_nulls(p_details);
  IF v_payload IS NOT DISTINCT FROM coalesce(e.payload,'{}'::jsonb) THEN
   RETURN jsonb_build_object('event_id',e.id,'changed',false); END IF;
  v_before:=to_jsonb(e);
  UPDATE public.app_match_events SET payload=v_payload WHERE id=e.id
  RETURNING to_jsonb(app_match_events.*) INTO v_after;
  INSERT INTO public.tm_app_event_revisions(match_id,event_id,editor_id,reason,previous_record,next_record,created_at)
  VALUES(p_match_id,e.id,auth.uid(),'Aggiornamento dettagli avanzati evento',v_before,v_after,clock_timestamp());
  RETURN jsonb_build_object('event_id',e.id,'changed',true);
END $function$
;
