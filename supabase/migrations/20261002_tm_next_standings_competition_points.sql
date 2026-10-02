-- Deployed through Supabase migration tm_next_standings_competition_points.
-- Preserve columns and grants; fix per-competition points instead of hardcoded 3/1/0.
CREATE OR REPLACE VIEW public.app_competition_standings AS
WITH completed AS (
 SELECT season_id,competition_id,id,home_team,away_team,home_score,away_score
 FROM public.app_competition_fixtures
 WHERE status='finished' AND home_score IS NOT NULL AND away_score IS NOT NULL
), teams AS (
 SELECT DISTINCT season_id,competition_id,home_team AS team FROM public.app_competition_fixtures
 UNION
 SELECT DISTINCT season_id,competition_id,away_team AS team FROM public.app_competition_fixtures
), stats AS (
 SELECT t.season_id,t.competition_id,t.team,
  count(c.id)::integer AS played,
  count(c.id) FILTER(WHERE (c.home_team=t.team AND c.home_score>c.away_score)
                            OR(c.away_team=t.team AND c.away_score>c.home_score))::integer AS won,
  count(c.id) FILTER(WHERE c.home_score=c.away_score)::integer AS drawn,
  count(c.id) FILTER(WHERE (c.home_team=t.team AND c.home_score<c.away_score)
                            OR(c.away_team=t.team AND c.away_score<c.home_score))::integer AS lost,
  coalesce(sum(CASE WHEN c.home_team=t.team THEN c.home_score
                    WHEN c.away_team=t.team THEN c.away_score ELSE 0 END),0)::integer AS goals_for,
  coalesce(sum(CASE WHEN c.home_team=t.team THEN c.away_score
                    WHEN c.away_team=t.team THEN c.home_score ELSE 0 END),0)::integer AS goals_against
 FROM teams t LEFT JOIN completed c ON c.season_id=t.season_id
  AND c.competition_id=t.competition_id AND (c.home_team=t.team OR c.away_team=t.team)
 GROUP BY t.season_id,t.competition_id,t.team
)
SELECT s.season_id,s.competition_id,s.team,s.played,s.won,s.drawn,s.lost,s.goals_for,s.goals_against,
(s.goals_for-s.goals_against)::integer AS goal_difference,
(s.won*coalesce(k.win_points,3)+s.drawn*coalesce(k.draw_points,1)
 +s.lost*coalesce(k.loss_points,0))::integer AS points
FROM stats s JOIN public.app_competitions k ON k.id=s.competition_id;