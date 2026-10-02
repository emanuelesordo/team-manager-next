-- Deployed Supabase migration: tm_next_live_tactical_changes_staff.
CREATE OR REPLACE FUNCTION public.tm_app_record_tactic(p_match_id uuid, p_minute integer, p_formation text, p_positions jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 m public.app_matches%ROWTYPE;
 item jsonb;
 player uuid;
 slot_no integer;
 seen_players uuid[]:='{}'::uuid[];
 seen_slots integer[]:='{}'::integer[];
 parts text[];
 part text;
 sum_players integer:=0;
 last_formation text;
 created uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Solo lo staff autorizzato può modificare la tattica';END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.status<>'live' OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Le variazioni tattiche richiedono un live collegato a una fixture';END IF;
 IF p_minute IS NULL OR p_minute NOT BETWEEN 0 AND 300 THEN RAISE EXCEPTION 'Minuto tattico non valido';END IF;
 IF p_formation IS NULL OR p_formation !~ '^[1-9](-[1-9]){1,4}$' THEN RAISE EXCEPTION 'Modulo non valido';END IF;
 parts:=string_to_array(p_formation,'-');
 FOREACH part IN ARRAY parts LOOP sum_players:=sum_players+part::integer;END LOOP;
 IF sum_players<>10 THEN RAISE EXCEPTION 'Il modulo deve prevedere dieci giocatori di movimento';END IF;
 IF jsonb_typeof(p_positions)<>'array' OR jsonb_array_length(p_positions) NOT BETWEEN 1 AND 11
 THEN RAISE EXCEPTION 'Servono da 1 a 11 posizioni';END IF;
 IF length(coalesce(p_notes,''))>500 THEN RAISE EXCEPTION 'Note troppo lunghe';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_positions) LOOP
  IF jsonb_typeof(item)<>'object' OR NOT(item ? 'player_id') OR NOT(item ? 'slot')
  THEN RAISE EXCEPTION 'Assegnazione tattica non valida';END IF;
  player:=(item->>'player_id')::uuid;
  slot_no:=(item->>'slot')::integer;
  IF slot_no NOT BETWEEN 1 AND 11 THEN RAISE EXCEPTION 'Posizione tattica fuori range';END IF;
  IF player=ANY(seen_players) OR slot_no=ANY(seen_slots) THEN RAISE EXCEPTION 'Posizione o giocatore duplicato';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.app_match_players mp
    WHERE mp.match_id=m.id AND mp.player_id=player AND mp.selection_status IN ('starter','bench'))
  THEN RAISE EXCEPTION 'Giocatore non convocato';END IF;
  IF NOT public.tm_app_player_eligible(m.id,player,p_minute)
  THEN RAISE EXCEPTION 'Giocatore non in campo nel minuto dichiarato';END IF;
  seen_players:=array_append(seen_players,player);
  seen_slots:=array_append(seen_slots,slot_no);
 END LOOP;
 SELECT formation_to INTO last_formation FROM public.app_match_tactical_changes
 WHERE match_id=m.id ORDER BY minute DESC,created_at DESC,id DESC LIMIT 1;
 IF last_formation IS NULL THEN last_formation:=m.formation;END IF;
 INSERT INTO public.app_match_tactical_changes
  (match_id,minute,formation_from,formation_to,positions,created_by,notes)
 VALUES(m.id,p_minute,last_formation,p_formation,p_positions,auth.uid(),nullif(btrim(p_notes),''))
 RETURNING id INTO created;
 RETURN created;
END $function$
;
REVOKE ALL ON FUNCTION public.tm_app_record_tactic(uuid,integer,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_record_tactic(uuid,integer,text,jsonb,text) TO authenticated;
