-- Verified goal score-state progression and rating distribution views.
CREATE OR REPLACE FUNCTION public.tm_goal_elapsed(p_match uuid, p_event_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.tm_app_elapsed_minute(p_match,e)
 FROM public.app_match_events e WHERE e.id=p_event_id AND e.match_id=p_match
$function$
;

CREATE OR REPLACE VIEW public.app_goal_context WITH (security_invoker=true) AS
 WITH candidate AS (
         SELECT m.season_id,
            m.competition_id,
            m.id AS match_id,
            e.id AS event_id,
            e.player_id,
                CASE
                    WHEN e.team_side = ANY (ARRAY['team'::text, 'opponent'::text]) THEN e.team_side
                    WHEN e.team_side = 'home'::text THEN
                    CASE
                        WHEN m.home_away = 'home'::text THEN 'team'::text
                        ELSE 'opponent'::text
                    END
                    WHEN e.team_side = 'away'::text THEN
                    CASE
                        WHEN m.home_away = 'away'::text THEN 'team'::text
                        ELSE 'opponent'::text
                    END
                    ELSE NULL::text
                END AS raw_side,
            e.event_type,
            tm_goal_elapsed(m.id, e.id) AS elapsed,
            m.home_away,
            f.home_score,
            f.away_score,
            e.created_at
           FROM app_match_events e
             JOIN app_matches m ON m.id = e.match_id
             JOIN app_competition_fixtures f ON f.id = m.fixture_id
          WHERE m.status = 'finished'::text AND NOT m.is_test AND f.status = 'finished'::text AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text])) AND (e.event_type = ANY (ARRAY['goal'::text, 'own_goal'::text, 'penalty_goal'::text, 'penalty_scored'::text])) AND COALESCE(e.payload ->> 'count_score'::text, 'true'::text) <> 'false'::text
        ), normalized AS (
         SELECT candidate.season_id,
            candidate.competition_id,
            candidate.match_id,
            candidate.event_id,
            candidate.player_id,
            candidate.raw_side,
            candidate.event_type,
            candidate.elapsed,
            candidate.home_away,
            candidate.home_score,
            candidate.away_score,
            candidate.created_at,
                CASE
                    WHEN candidate.event_type = 'own_goal'::text THEN
                    CASE
                        WHEN candidate.raw_side = 'team'::text THEN 'opponent'::text
                        ELSE 'team'::text
                    END
                    ELSE candidate.raw_side
                END AS scoring_side
           FROM candidate
        ), quality AS (
         SELECT normalized.match_id,
            count(*) AS total,
            count(*) FILTER (WHERE normalized.elapsed IS NULL OR normalized.raw_side IS NULL) AS unknown,
            count(*) FILTER (WHERE normalized.scoring_side = 'team'::text) AS team_goals,
            count(*) FILTER (WHERE normalized.scoring_side = 'opponent'::text) AS opp_goals,
            max(normalized.home_score) AS home_score,
            max(normalized.away_score) AS away_score,
            max(normalized.home_away) AS home_away
           FROM normalized
          GROUP BY normalized.match_id
        ), seq AS (
         SELECT n.season_id,
            n.competition_id,
            n.match_id,
            n.event_id,
            n.player_id,
            n.raw_side,
            n.event_type,
            n.elapsed,
            n.home_away,
            n.home_score,
            n.away_score,
            n.created_at,
            n.scoring_side,
            q.unknown = 0 AND q.total = (q.team_goals + q.opp_goals) AND q.team_goals =
                CASE
                    WHEN q.home_away = 'home'::text THEN q.home_score
                    ELSE q.away_score
                END AND q.opp_goals =
                CASE
                    WHEN q.home_away = 'home'::text THEN q.away_score
                    ELSE q.home_score
                END AS verified,
            count(*) FILTER (WHERE n.scoring_side = 'team'::text) OVER w -
                CASE
                    WHEN n.scoring_side = 'team'::text THEN 1
                    ELSE 0
                END AS before_gf,
            count(*) FILTER (WHERE n.scoring_side = 'opponent'::text) OVER w -
                CASE
                    WHEN n.scoring_side = 'opponent'::text THEN 1
                    ELSE 0
                END AS before_ga
           FROM normalized n
             JOIN quality q ON q.match_id = n.match_id
          WINDOW w AS (PARTITION BY n.match_id ORDER BY n.elapsed, n.created_at, n.event_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        )
 SELECT season_id,
    competition_id,
    match_id,
    event_id,
        CASE
            WHEN scoring_side = 'team'::text AND event_type <> 'own_goal'::text THEN player_id
            ELSE NULL::uuid
        END AS player_id,
    scoring_side,
    elapsed,
    before_gf,
    before_ga,
    before_gf +
        CASE
            WHEN scoring_side = 'team'::text THEN 1
            ELSE 0
        END AS after_gf,
    before_ga +
        CASE
            WHEN scoring_side = 'opponent'::text THEN 1
            ELSE 0
        END AS after_ga,
    verified,
    scoring_side = 'team'::text AND before_gf = before_ga AS opener_or_lead,
    scoring_side = 'team'::text AND (before_gf + 1) = before_ga AS equalizer,
    scoring_side = 'team'::text AND before_gf = before_ga AS go_ahead,
    scoring_side = 'team'::text AND before_gf < before_ga AS scored_while_trailing,
    scoring_side = 'team'::text AND (before_gf + 1) < before_ga AS reduced_deficit,
    scoring_side = 'team'::text AND before_gf > before_ga AS extended_lead,
    scoring_side = 'team'::text AND before_gf > 0 AND before_ga > 0 AND before_gf = before_ga AS go_ahead_after_equal,
    scoring_side = 'team'::text AND before_ga > 0 AND before_gf < before_ga AND (before_gf + 1) = before_ga AS comeback_equalizer
   FROM seq;

CREATE OR REPLACE VIEW public.app_player_goal_impact WITH (security_invoker=true) AS
 SELECT season_id,
    player_id,
    count(*) FILTER (WHERE scoring_side = 'team'::text)::integer AS scored,
    count(*) FILTER (WHERE equalizer)::integer AS equalizers,
    count(*) FILTER (WHERE go_ahead)::integer AS go_ahead_goals,
    count(*) FILTER (WHERE reduced_deficit)::integer AS deficit_reducers,
    count(*) FILTER (WHERE scored_while_trailing)::integer AS trailing_goals,
    count(*) FILTER (WHERE extended_lead)::integer AS lead_extenders,
    count(*) FILTER (WHERE comeback_equalizer)::integer AS comeback_equalizers,
    count(*) FILTER (WHERE go_ahead_after_equal)::integer AS regained_leads,
    count(DISTINCT match_id)::integer AS scoring_matches,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND (after_gf - after_ga) = 1)::integer AS goals_to_plus_1,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND (after_gf - after_ga) = 2)::integer AS goals_to_plus_2,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND (after_gf - after_ga) >= 3)::integer AS goals_to_plus_3,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND (after_gf - after_ga) = '-1'::integer)::integer AS goals_to_minus_1,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND (after_gf - after_ga) <= '-2'::integer)::integer AS goals_to_minus_2,
    count(*) FILTER (WHERE scoring_side = 'team'::text AND after_gf = after_ga)::integer AS goals_to_draw
   FROM app_goal_context
  WHERE verified AND player_id IS NOT NULL
  GROUP BY season_id, player_id;

CREATE OR REPLACE VIEW public.app_player_rating_insights WITH (security_invoker=true) AS
 SELECT season_id,
    player_id,
    count(*) FILTER (WHERE avg_rating IS NOT NULL AND votes > 0)::integer AS rated_matches,
    sum(votes)::integer AS votes_received,
    round(avg(avg_rating), 2) AS avg_match_rating,
    round(min(avg_rating), 2) AS lowest_rating,
    round(max(avg_rating), 2) AS highest_rating,
    round(stddev_pop(avg_rating), 2) AS rating_volatility,
    count(*) FILTER (WHERE avg_rating >= 7::numeric)::integer AS high_rating_games,
    count(*) FILTER (WHERE avg_rating < 6::numeric)::integer AS low_rating_games
   FROM tm_player_recent_votes
  GROUP BY season_id, player_id;

REVOKE ALL ON FUNCTION public.tm_goal_elapsed(uuid,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tm_goal_elapsed(uuid,uuid) TO anon,authenticated;

GRANT SELECT ON public.app_goal_context,public.app_player_goal_impact,public.app_player_rating_insights TO anon,authenticated;

NOTIFY pgrst,'reload schema';