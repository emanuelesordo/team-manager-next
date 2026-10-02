CREATE OR REPLACE FUNCTION public.tm_app_add_competition_opponents(
 p_competition_id uuid,p_opponent_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE n integer;v_count integer;added integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Operazione riservata allo staff';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_competitions c WHERE c.id=p_competition_id) THEN RAISE EXCEPTION 'Competizione inesistente';END IF;
 IF coalesce(cardinality(p_opponent_ids),0)>250 THEN RAISE EXCEPTION 'Troppi partecipanti';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tm_app_competition_opponents:'||p_competition_id::text,0));
 SELECT count(*) INTO n FROM (SELECT DISTINCT unnest(coalesce(p_opponent_ids,'{}'::uuid[])) AS id) x;
 SELECT count(*) INTO v_count FROM public.app_opponents o WHERE o.id IN
  (SELECT DISTINCT unnest(coalesce(p_opponent_ids,'{}'::uuid[])));
 IF n<>v_count THEN RAISE EXCEPTION 'Una o più avversarie non esistono';END IF;
 WITH inserted AS (
  INSERT INTO public.app_competition_opponents(competition_id,opponent_id)
  SELECT p_competition_id,id FROM (SELECT DISTINCT unnest(coalesce(p_opponent_ids,'{}'::uuid[])) id) q
  ON CONFLICT(competition_id,opponent_id) DO NOTHING RETURNING opponent_id)
 SELECT count(*) INTO added FROM inserted;
 RETURN jsonb_build_object('ok',true,'added',added,'total_requested',n);
END $function$;
REVOKE ALL ON FUNCTION public.tm_app_add_competition_opponents(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_add_competition_opponents(uuid,uuid[]) TO authenticated;