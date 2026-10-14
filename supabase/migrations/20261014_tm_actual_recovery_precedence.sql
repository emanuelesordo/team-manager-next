-- A confirmed actual recovery from the live period clock supersedes imported estimates.
-- Preserve historical events; alter only deterministic selection in the canonical view.
DO $$
DECLARE definition text;
BEGIN
 definition:=pg_get_viewdef('private.tm_player_match_participation'::regclass,true);
 IF position('e.created_at DESC NULLS LAST, e.id DESC' in definition)=0 THEN
  RAISE EXCEPTION 'Expected period_end ordering not found';
 END IF;
 IF position('e.payload ->> ''recovery_actual''' in definition)=0
  OR position('e.payload ->> ''entered_from''' in definition)=0 THEN
  -- The expressions below will add their explicit precedence.
  NULL;
 END IF;
 IF position('(CASE WHEN e.payload ->> ''recovery_actual'' IS NOT NULL THEN 1 ELSE 0 END) DESC' in definition)=0 THEN
  definition:=replace(definition,'e.created_at DESC NULLS LAST, e.id DESC',
   '(CASE WHEN e.payload->>''recovery_actual'' IS NOT NULL THEN 1 ELSE 0 END) DESC, (CASE WHEN e.payload->>''entered_from'' = ''period_control'' THEN 1 ELSE 0 END) DESC, e.created_at DESC NULLS LAST, e.id DESC');
  EXECUTE 'CREATE OR REPLACE VIEW private.tm_player_match_participation AS '||definition;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
