-- Team Manager Next: calendar CSV import. Deployed as Supabase migration tm_next_atomic_fixture_csv_import.
-- Safe repeatable DDL: does not remove tables, records or constraints.
CREATE OR REPLACE FUNCTION public.tm_app_import_fixtures(p_competition_id uuid,p_rows jsonb,p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 c public.app_competitions%ROWTYPE;
 s public.app_seasons%ROWTYPE;
 item jsonb;
 no integer;
 kick timestamptz;
 home_name text;
 away_name text;
 location_name text;
 location_address text;
 item_key text;
 seen text[]:='{}'::text[];
 found_id uuid;
 scanned integer:=0;
 insert_count integer:=0;
 existing_count integer:=0;
 duplicate_count integer:=0;
 id_returned uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_staff()) THEN
  RAISE EXCEPTION 'Solo lo staff autorizzato può importare il calendario';
 END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 250 THEN
  RAISE EXCEPTION 'Il file deve contenere da 1 a 250 incontri';
 END IF;
 SELECT * INTO c FROM public.app_competitions WHERE id=p_competition_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Competizione inesistente'; END IF;
 SELECT * INTO s FROM public.app_seasons WHERE id=c.season_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stagione inesistente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tm_app_import:'||p_competition_id::text,0));
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  scanned:=scanned+1;
  IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'Riga %: oggetto JSON non valido',scanned; END IF;
  no:=NULLIF(trim(item->>'round_no'),'')::integer;
  home_name:=NULLIF(trim(item->>'home_team'),'');
  away_name:=NULLIF(trim(item->>'away_team'),'');
  kick:=NULLIF(trim(item->>'kickoff_at'),'')::timestamptz;
  location_name:=NULLIF(trim(item->>'venue_name'),'');
  location_address:=NULLIF(trim(item->>'venue_address'),'');
  IF no IS NULL OR no NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Riga %: giornata non valida',scanned; END IF;
  IF kick IS NULL OR kick < (s.start_date-interval '90 days') OR kick > (s.end_date+interval '150 days') THEN
   RAISE EXCEPTION 'Riga %: data fuori dai limiti della stagione',scanned;
  END IF;
  IF home_name IS NULL OR away_name IS NULL OR length(home_name)>160 OR length(away_name)>160 OR lower(home_name)=lower(away_name) THEN
   RAISE EXCEPTION 'Riga %: squadre non valide',scanned;
  END IF;
  IF length(coalesce(location_name,''))>180 OR length(coalesce(location_address,''))>400 THEN
   RAISE EXCEPTION 'Riga %: campo/indirizzo troppo lungo',scanned;
  END IF;
  item_key:=no::text||'|'||lower(home_name)||'|'||lower(away_name);
  IF item_key=ANY(seen) THEN duplicate_count:=duplicate_count+1;CONTINUE;END IF;
  seen:=array_append(seen,item_key);
  SELECT id INTO found_id FROM public.app_competition_fixtures
   WHERE competition_id=c.id AND round_no=no AND lower(btrim(home_team))=lower(btrim(home_name))
     AND lower(btrim(away_team))=lower(btrim(away_name)) LIMIT 1;
  IF found_id IS NOT NULL THEN existing_count:=existing_count+1;CONTINUE;END IF;
  IF NOT p_dry_run THEN
   INSERT INTO public.app_competition_fixtures
    (season_id,competition_id,round_no,kickoff_at,home_team,away_team,venue_name,venue_address,
     status,home_score,away_score,source,source_imported_at)
   VALUES(c.season_id,c.id,no,kick,home_name,away_name,location_name,location_address,
     'scheduled',NULL,NULL,'staff_csv',now())
   ON CONFLICT (competition_id,round_no,home_team,away_team) DO NOTHING
   RETURNING id INTO id_returned;
   IF id_returned IS NULL THEN existing_count:=existing_count+1; ELSE insert_count:=insert_count+1;END IF;
  ELSE insert_count:=insert_count+1;END IF;
  found_id:=NULL;id_returned:=NULL;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'dry_run',p_dry_run,'rows',scanned,'new',insert_count,
  'existing',existing_count,'duplicates',duplicate_count,'competition_id',c.id);
END $function$;
REVOKE ALL ON FUNCTION public.tm_app_import_fixtures(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_import_fixtures(uuid,jsonb,boolean) TO authenticated;
COMMENT ON FUNCTION public.tm_app_import_fixtures(uuid,jsonb,boolean)
 IS 'Atomic staff-only CSV calendar ingestion: inserts new scheduled fixtures; never overwrites live/historical matches, events, scores.';
