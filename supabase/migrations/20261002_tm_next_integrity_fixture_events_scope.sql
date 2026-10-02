-- Excludes fixture-only events with a valid fixture_id and no linked team match_id.
CREATE OR REPLACE FUNCTION public.tm_app_integrity_report()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_staff()) THEN
  RAISE EXCEPTION 'Operazione riservata allo staff';
 END IF;
 WITH issues AS (
  SELECT 'unlinked_match'::text kind, m.id match_id,NULL::uuid fixture_id,
         'Tabellino senza fixture'::text message
   FROM public.app_matches m WHERE m.fixture_id IS NULL
  UNION ALL
  SELECT 'invalid_fixture',m.id,m.fixture_id,'La fixture collegata non esiste'
   FROM public.app_matches m LEFT JOIN public.app_competition_fixtures f ON f.id=m.fixture_id
   WHERE m.fixture_id IS NOT NULL AND f.id IS NULL
  UNION ALL
  SELECT 'mismatched_scope',m.id,m.fixture_id,'Stagione o competizione incoerente'
   FROM public.app_matches m JOIN public.app_competition_fixtures f ON f.id=m.fixture_id
   WHERE m.season_id IS DISTINCT FROM f.season_id OR m.competition_id IS DISTINCT FROM f.competition_id
  UNION ALL
  SELECT 'score_difference',m.id,m.fixture_id,
   format('Risultato ufficiale %s-%s, tabellino %s-%s',f.home_score,f.away_score,m.home_score,m.away_score)
   FROM public.app_matches m JOIN public.app_competition_fixtures f ON f.id=m.fixture_id
   WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL
    AND (m.home_score<>f.home_score OR m.away_score<>f.away_score)
  UNION ALL
  SELECT 'orphan_player',p.match_id,NULL::uuid, 'Convocazione senza partita'
   FROM public.app_match_players p LEFT JOIN public.app_matches m ON m.id=p.match_id WHERE m.id IS NULL
  UNION ALL
  SELECT 'orphan_event',e.match_id,NULL::uuid, 'Evento senza partita'
   FROM public.app_match_events e LEFT JOIN public.app_matches m ON m.id=e.match_id WHERE e.match_id IS NOT NULL AND m.id IS NULL
 ),
 limited AS (SELECT kind,match_id,fixture_id,message FROM issues ORDER BY kind,match_id LIMIT 100)
 SELECT jsonb_build_object('checked_at',now(),
   'issue_count',(SELECT count(*) FROM issues),
   'by_type',coalesce((SELECT jsonb_object_agg(kind,amount) FROM
     (SELECT kind,count(*) amount FROM issues GROUP BY kind) t),'{}'::jsonb),
   'issues',coalesce((SELECT jsonb_agg(to_jsonb(limited)) FROM limited),'[]'::jsonb))
 INTO result;
 RETURN result;
END $function$
;