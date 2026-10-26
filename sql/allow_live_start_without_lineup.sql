-- Team Manager Next: the live clock must be able to start before the lineup is entered.
-- Applied to the production database on 2026-10-26.
-- Keep the rest of each function (permissions, clocks, events) unchanged.
DO $migration$
DECLARE
  function_name text;
  function_sql text;
  old_guard text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY['tm_app_start_live_v2', 'tm_app_match_action'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO function_sql
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = function_name;

    IF function_sql IS NULL THEN
      RAISE EXCEPTION 'Missing function public.%', function_name;
    END IF;

    IF function_name = 'tm_app_start_live_v2' THEN
      old_guard := 'IF NOT m.is_test AND v_roster<>11 THEN RAISE EXCEPTION ''Prima del live servono 11 titolari (attualmente %)'',v_roster;END IF;';
    ELSE
      old_guard := 'IF v_roster<>11 THEN RAISE EXCEPTION ''Prima del live servono 11 titolari (attualmente %) '',v_roster; END IF;';
    END IF;

    IF position(old_guard IN function_sql) > 0 THEN
      function_sql := replace(function_sql, old_guard, '-- Lineup can be entered after the live starts.');
      EXECUTE function_sql;
    ELSIF position('v_roster<>11' IN function_sql) > 0 THEN
      RAISE EXCEPTION 'Unexpected lineup check in public.%: manual review required', function_name;
    END IF;
  END LOOP;
END;
$migration$;
