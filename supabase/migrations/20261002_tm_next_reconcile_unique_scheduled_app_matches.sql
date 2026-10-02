-- Applied: strict one-to-one linking of previously unlinked *scheduled* operational
-- matches only. Live, finished, conflicting scores and ambiguous IDs unchanged.
WITH possible AS (
 SELECT m.id AS mid,f.id AS fid,
  count(*) OVER(PARTITION BY m.id) matches_for_match,
  count(*) OVER(PARTITION BY f.id) matches_for_fixture
 FROM public.app_matches m JOIN public.app_opponents o ON o.id=m.opponent_id
 JOIN public.app_seasons s ON s.id=m.season_id
 JOIN public.teams t ON t.id=s.team_id
 JOIN public.app_competition_fixtures f ON
   f.season_id=m.season_id AND f.competition_id=m.competition_id
   AND f.kickoff_at=m.kickoff_at AND f.round_no::text=m.round_label
   AND ((m.home_away='home' AND lower(f.home_team)=lower(t.name))
       OR(m.home_away='away' AND lower(f.away_team)=lower(t.name)))
 WHERE m.fixture_id IS NULL AND m.status='scheduled' AND f.status='scheduled'
 AND m.live_started_at IS NULL AND m.finalized_at IS NULL
 AND m.home_score=0 AND m.away_score=0
 AND f.home_score IS NULL AND f.away_score IS NULL
 AND length(regexp_replace(lower(o.name),'[^a-z0-9]','','g'))>=6
 AND strpos(regexp_replace(lower(
      CASE WHEN m.home_away='home' THEN f.away_team ELSE f.home_team END
      ),'[^a-z0-9]','','g'),regexp_replace(lower(o.name),'[^a-z0-9]','','g'))>0
), unambiguous AS (
 SELECT mid,fid FROM possible
 WHERE matches_for_match=1 AND matches_for_fixture=1
)
UPDATE public.app_matches m SET fixture_id=c.fid
FROM unambiguous c
WHERE m.id=c.mid AND m.fixture_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.app_matches other WHERE other.fixture_id=c.fid);
