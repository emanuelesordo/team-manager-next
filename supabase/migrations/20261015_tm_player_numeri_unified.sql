-- Unified source-of-truth for all player rankings and canonical per-80 rates.
CREATE OR REPLACE VIEW public.app_player_numeri WITH (security_invoker=true) AS
 SELECT s.season_id,
    s.player_id,
    s.first_name,
    s.last_name,
    s.position_group,
    s.appearances,
    s.starts,
    s.subentries,
    s.minutes,
    s.goals,
    s.assists,
    s.yellow_cards,
    s.red_cards,
    s.disciplinary_cards,
    s.avg_rating,
    s.goals_for_on,
    s.goals_against_on,
    s.plus_minus_on,
    s.impact_coverage,
        CASE
            WHEN s.minutes > 0 THEN round(s.goals::numeric * 80::numeric / s.minutes::numeric, 2)
            ELSE NULL::numeric
        END AS goals_per_80,
        CASE
            WHEN s.minutes > 0 THEN round(s.assists::numeric * 80::numeric / s.minutes::numeric, 2)
            ELSE NULL::numeric
        END AS assists_per_80,
        CASE
            WHEN s.impact_coverage = 'complete'::text AND s.minutes > 0 THEN round(s.goals_for_on::numeric * 80::numeric / s.minutes::numeric, 2)
            ELSE NULL::numeric
        END AS gf_on_per_80,
        CASE
            WHEN s.impact_coverage = 'complete'::text AND s.minutes > 0 THEN round(s.goals_against_on::numeric * 80::numeric / s.minutes::numeric, 2)
            ELSE NULL::numeric
        END AS ga_on_per_80,
        CASE
            WHEN s.impact_coverage = 'complete'::text AND s.minutes > 0 THEN round(s.plus_minus_on::numeric * 80::numeric / s.minutes::numeric, 2)
            ELSE NULL::numeric
        END AS plus_minus_per_80,
        CASE
            WHEN s.appearances > 0 THEN round(s.minutes::numeric / s.appearances::numeric, 2)
            ELSE NULL::numeric
        END AS minutes_per_appearance,
        CASE
            WHEN s.appearances > 0 THEN round(s.starts::numeric * 100::numeric / s.appearances::numeric, 2)
            ELSE NULL::numeric
        END AS start_rate,
    r.rated_matches,
    r.votes_received,
    r.avg_match_rating,
    r.lowest_rating,
    r.highest_rating,
    r.rating_volatility,
    r.high_rating_games,
    r.low_rating_games,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.equalizers
            ELSE NULL::integer
        END AS equalizers,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.go_ahead_goals
            ELSE NULL::integer
        END AS go_ahead_goals,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.trailing_goals
            ELSE NULL::integer
        END AS trailing_goals,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.deficit_reducers
            ELSE NULL::integer
        END AS deficit_reducers,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.comeback_equalizers
            ELSE NULL::integer
        END AS comeback_equalizers,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN COALESCE(cb.comeback_go_ahead_goals, 0)
            ELSE NULL::integer
        END AS comeback_go_ahead_goals,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.lead_extenders
            ELSE NULL::integer
        END AS lead_extenders,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_plus_1
            ELSE NULL::integer
        END AS goals_to_plus_1,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_plus_2
            ELSE NULL::integer
        END AS goals_to_plus_2,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_plus_3
            ELSE NULL::integer
        END AS goals_to_plus_3,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_minus_1
            ELSE NULL::integer
        END AS goals_to_minus_1,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_minus_2
            ELSE NULL::integer
        END AS goals_to_minus_2,
        CASE
            WHEN s.goals = 0 THEN 0
            WHEN g.scored = s.goals THEN g.goals_to_draw
            ELSE NULL::integer
        END AS goals_to_draw
   FROM app_player_calculated_season s
     LEFT JOIN app_player_rating_insights r ON r.season_id = s.season_id AND r.player_id = s.player_id
     LEFT JOIN app_player_goal_impact g ON g.season_id = s.season_id AND g.player_id = s.player_id
     LEFT JOIN app_player_comeback_leads cb ON cb.season_id = s.season_id AND cb.player_id = s.player_id;
GRANT SELECT ON public.app_player_numeri TO anon,authenticated;
NOTIFY pgrst,'reload schema';