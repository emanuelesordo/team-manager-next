-- Expose validated per-match minutes through the same final season statistics view.
-- This is a read-only JSON projection of private.tm_player_match_participation.
DO $$
DECLARE definition text;
BEGIN
 definition:=pg_get_viewdef('public.app_player_season_stats'::regclass,true);
 IF position('AS match_minutes' in definition)>0 THEN RETURN; END IF;
 IF position('END AS minutes_coverage' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected season statistics definition; cannot safely append match facts';
 END IF;
 definition:=replace(definition,'END AS minutes_coverage',
 'END AS minutes_coverage,
  (SELECT jsonb_agg(jsonb_build_object(
   ''match_id'',x.match_id,''minutes'',x.minutes,''valid'',x.valid,
   ''appeared'',x.appeared,''started'',x.started,''subentered'',x.subentered
  ) ORDER BY x.match_id)
  FROM private.tm_player_match_participation x
  WHERE x.season_id=ar.season_id AND x.player_id=ar.player_id AND x.appeared
  ) AS match_minutes');
 EXECUTE 'CREATE OR REPLACE VIEW public.app_player_season_stats AS '||definition;
END $$;
NOTIFY pgrst,'reload schema';
