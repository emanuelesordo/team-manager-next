-- 2026-10-02 — Canonical events and fixture scores. Deployed to Supabase.
-- app_match_events is the sole active event table. Fixture-only events have no app_matches match_id.
ALTER TABLE public.app_match_events
 ADD COLUMN IF NOT EXISTS fixture_id uuid REFERENCES public.app_competition_fixtures(id) ON DELETE RESTRICT;
ALTER TABLE public.app_match_events ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE public.app_match_events DROP CONSTRAINT IF EXISTS app_match_events_team_side_check;
ALTER TABLE public.app_match_events ADD CONSTRAINT app_match_events_team_side_check
 CHECK(team_side IN('team','opponent','home','away'));

UPDATE public.app_match_events e
SET fixture_id=m.fixture_id
FROM public.app_matches m
WHERE e.match_id=m.id AND m.fixture_id IS NOT NULL
 AND e.fixture_id IS DISTINCT FROM m.fixture_id;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.app_match_events WHERE fixture_id IS NULL) THEN
  RAISE EXCEPTION 'Event fixture missing: abort migration';
 END IF;
END $$;
ALTER TABLE public.app_match_events ALTER COLUMN fixture_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tm_app_match_events_fixture_idx
 ON public.app_match_events(fixture_id,minute,created_at);
CREATE OR REPLACE FUNCTION public.tm_app_event_fixture_key()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE linked_fixture uuid;
BEGIN
 IF NEW.match_id IS NOT NULL THEN
  SELECT m.fixture_id INTO linked_fixture FROM public.app_matches m WHERE m.id=NEW.match_id;
  IF linked_fixture IS NULL THEN RAISE EXCEPTION 'Event must reference a linked match'; END IF;
  IF NEW.fixture_id IS NOT NULL AND NEW.fixture_id IS DISTINCT FROM linked_fixture THEN
   RAISE EXCEPTION 'Event fixture and match do not correspond'; END IF;
  NEW.fixture_id:=linked_fixture;
  IF NEW.team_side NOT IN('team','opponent') THEN
   RAISE EXCEPTION 'Linked match events use team/opponent'; END IF;
 ELSE
  IF NEW.fixture_id IS NULL OR NEW.team_side NOT IN('home','away') THEN
   RAISE EXCEPTION 'Fixture-only event requires fixture and home/away side'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tm_app_event_fixture_key ON public.app_match_events;
CREATE TRIGGER tm_app_event_fixture_key
 BEFORE INSERT OR UPDATE OF fixture_id,match_id,team_side ON public.app_match_events
 FOR EACH ROW EXECUTE FUNCTION public.tm_app_event_fixture_key();

-- Copy legacy fixture events into the canonical table, keeping identifiers and original sources.
-- Legacy snapshots are NOT authoritative and remain in the payload.
INSERT INTO public.app_match_events
 (id,match_id,fixture_id,event_type,minute,stoppage_minute,team_side,payload,
  proposed_by,validation_status,source,source_event_key,source_raw,created_at)
SELECT id,NULL,fixture_id,event_type,minute,stoppage_minute,side,
 jsonb_build_object('legacy_fixture_score',
   jsonb_build_object('home',home_score,'away',away_score),
   'origin','legacy_fixture_event','scorer_known',false),
 created_by,'proposed',source,source_event_key,source_raw,created_at
FROM public.app_fixture_events
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.app_fixture_events) <>
    (SELECT count(*) FROM public.app_match_events WHERE payload->>'origin'='legacy_fixture_event')
 THEN RAISE EXCEPTION 'Legacy fixture events not fully copied: abort migration'; END IF;
END $$;

ALTER TABLE public.app_fixture_events RENAME TO tm_legacy_fixture_events_20261002;
REVOKE INSERT,UPDATE,DELETE ON public.tm_legacy_fixture_events_20261002 FROM PUBLIC,anon,authenticated;
CREATE VIEW public.app_fixture_events WITH (security_invoker=true) AS
 SELECT e.id,e.fixture_id,e.event_type,e.minute,e.stoppage_minute,
  e.team_side AS side,
  (e.payload#>>'{legacy_fixture_score,home}')::smallint AS home_score,
  (e.payload#>>'{legacy_fixture_score,away}')::smallint AS away_score,
  e.source,e.source_event_key,e.source_raw,e.proposed_by AS created_by,e.created_at
 FROM public.app_match_events e
 WHERE e.match_id IS NULL AND e.payload->>'origin'='legacy_fixture_event';
REVOKE ALL ON public.app_fixture_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.app_fixture_events TO anon,authenticated;

-- Keep the old app_matches score fields for compatibility, but project them from fixture.
CREATE OR REPLACE FUNCTION public.tm_app_match_score_from_fixture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE canonical_home smallint;canonical_away smallint;
BEGIN
 IF NEW.fixture_id IS NOT NULL THEN
  SELECT f.home_score,f.away_score INTO canonical_home,canonical_away
   FROM public.app_competition_fixtures f WHERE f.id=NEW.fixture_id;
  IF canonical_home IS NOT NULL AND canonical_away IS NOT NULL THEN
   NEW.home_score:=canonical_home; NEW.away_score:=canonical_away;
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tm_app_match_score_from_fixture ON public.app_matches;
CREATE TRIGGER tm_app_match_score_from_fixture BEFORE INSERT OR UPDATE OF fixture_id,home_score,away_score
 ON public.app_matches FOR EACH ROW EXECUTE FUNCTION public.tm_app_match_score_from_fixture();

CREATE OR REPLACE FUNCTION public.tm_app_fixture_score_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
   AND (OLD.home_score IS DISTINCT FROM NEW.home_score OR OLD.away_score IS DISTINCT FROM NEW.away_score) THEN
  UPDATE public.app_matches SET home_score=NEW.home_score,away_score=NEW.away_score
   WHERE fixture_id=NEW.id
    AND (home_score IS DISTINCT FROM NEW.home_score OR away_score IS DISTINCT FROM NEW.away_score);
 END IF;
 RETURN NULL;
END $fn$;
DROP TRIGGER IF EXISTS tm_app_fixture_score_sync ON public.app_competition_fixtures;
CREATE TRIGGER tm_app_fixture_score_sync AFTER UPDATE OF home_score,away_score
 ON public.app_competition_fixtures FOR EACH ROW EXECUTE FUNCTION public.tm_app_fixture_score_sync();

-- Backfill technical score projections; does not modify official fixture scores or approve events.
UPDATE public.app_matches m SET home_score=f.home_score,away_score=f.away_score
 FROM public.app_competition_fixtures f
 WHERE m.fixture_id=f.id AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL
 AND (m.home_score IS DISTINCT FROM f.home_score OR m.away_score IS DISTINCT FROM f.away_score);
