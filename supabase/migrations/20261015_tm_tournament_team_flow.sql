-- Per-team reconciled match-flow statistics for tournament comparisons.
CREATE OR REPLACE VIEW public.app_tournament_team_flow WITH (security_invoker=true) AS
 WITH source_games AS (
         SELECT f.season_id,
            f.competition_id,
            f.id AS fixture_id,
            f.home_team,
            f.away_team,
            f.home_score,
            f.away_score,
            fl.duration,
            fl.nil_minutes,
            fl.draw_minutes,
            fl.home_lead_minutes,
            fl.away_lead_minutes,
            fl.home_comeback_equalizers,
            fl.away_comeback_equalizers,
            fl.home_go_aheads,
            fl.away_go_aheads
           FROM app_fixture_tournament_flow fl
             JOIN app_competition_fixtures f ON f.id = fl.fixture_id
        UNION ALL
         SELECT f.season_id,
            f.competition_id,
            f.id,
            f.home_team,
            f.away_team,
            f.home_score,
            f.away_score,
            fl.duration,
            fl.nil_minutes,
            fl.draw_minutes,
                CASE
                    WHEN m.home_away = 'home'::text THEN fl.lead_minutes
                    ELSE fl.trail_minutes
                END AS trail_minutes,
                CASE
                    WHEN m.home_away = 'away'::text THEN fl.lead_minutes
                    ELSE fl.trail_minutes
                END AS trail_minutes,
                CASE
                    WHEN m.home_away = 'home'::text THEN fl.comeback_equalizers
                    ELSE fl.opponent_equalizers
                END AS opponent_equalizers,
                CASE
                    WHEN m.home_away = 'away'::text THEN fl.comeback_equalizers
                    ELSE fl.opponent_equalizers
                END AS opponent_equalizers,
                CASE
                    WHEN m.home_away = 'home'::text THEN fl.leads_taken
                    ELSE 0
                END AS "case",
                CASE
                    WHEN m.home_away = 'away'::text THEN fl.leads_taken
                    ELSE 0
                END AS "case"
           FROM app_match_flow_numbers fl
             JOIN app_matches m ON m.id = fl.match_id
             JOIN app_competition_fixtures f ON f.id = m.fixture_id
          WHERE fl.verified
        ), sides AS (
         SELECT source_games.season_id,
            source_games.competition_id,
            source_games.fixture_id,
            source_games.home_team AS team_name,
            source_games.duration,
            source_games.nil_minutes,
            source_games.draw_minutes,
            source_games.home_lead_minutes AS leading_minutes,
            source_games.away_lead_minutes AS trailing_minutes,
            source_games.home_comeback_equalizers AS comeback_equalizers,
            source_games.home_go_aheads AS leads_taken
           FROM source_games
        UNION ALL
         SELECT source_games.season_id,
            source_games.competition_id,
            source_games.fixture_id,
            source_games.away_team,
            source_games.duration,
            source_games.nil_minutes,
            source_games.draw_minutes,
            source_games.away_lead_minutes,
            source_games.home_lead_minutes,
            source_games.away_comeback_equalizers,
            source_games.away_go_aheads
           FROM source_games
        ), scheduled AS (
         SELECT app_competition_fixtures.season_id,
            app_competition_fixtures.competition_id,
            app_competition_fixtures.home_team AS team_name,
            count(*) AS played
           FROM app_competition_fixtures
          WHERE app_competition_fixtures.status = 'finished'::text AND NOT app_competition_fixtures.is_test AND app_competition_fixtures.home_score IS NOT NULL AND app_competition_fixtures.away_score IS NOT NULL
          GROUP BY app_competition_fixtures.season_id, app_competition_fixtures.competition_id, app_competition_fixtures.home_team
        UNION ALL
         SELECT app_competition_fixtures.season_id,
            app_competition_fixtures.competition_id,
            app_competition_fixtures.away_team,
            count(*) AS count
           FROM app_competition_fixtures
          WHERE app_competition_fixtures.status = 'finished'::text AND NOT app_competition_fixtures.is_test AND app_competition_fixtures.home_score IS NOT NULL AND app_competition_fixtures.away_score IS NOT NULL
          GROUP BY app_competition_fixtures.season_id, app_competition_fixtures.competition_id, app_competition_fixtures.away_team
        ), totals AS (
         SELECT scheduled.season_id,
            scheduled.competition_id,
            lower(TRIM(BOTH FROM scheduled.team_name)) AS team_key,
            min(scheduled.team_name) AS team_name,
            sum(scheduled.played)::integer AS played
           FROM scheduled
          WHERE NULLIF(TRIM(BOTH FROM scheduled.team_name), ''::text) IS NOT NULL
          GROUP BY scheduled.season_id, scheduled.competition_id, (lower(TRIM(BOTH FROM scheduled.team_name)))
        ), aggregates AS (
         SELECT sides.season_id,
            sides.competition_id,
            lower(TRIM(BOTH FROM sides.team_name)) AS team_key,
            count(*)::integer AS verified_games,
            round(sum(sides.duration), 2) AS duration,
            round(sum(sides.nil_minutes), 2) AS nil_minutes,
            round(sum(sides.draw_minutes) - sum(sides.nil_minutes), 2) AS scored_draw_minutes,
            round(sum(sides.leading_minutes), 2) AS leading_minutes,
            round(sum(sides.trailing_minutes), 2) AS trailing_minutes,
            sum(sides.comeback_equalizers)::integer AS comeback_equalizers,
            sum(sides.leads_taken)::integer AS leads_taken
           FROM sides
          GROUP BY sides.season_id, sides.competition_id, (lower(TRIM(BOTH FROM sides.team_name)))
        )
 SELECT t.season_id,
    t.competition_id,
    t.team_name,
    t.played,
    COALESCE(a.verified_games, 0) AS verified_games,
    t.played - COALESCE(a.verified_games, 0) AS missing_games,
    a.duration,
    a.nil_minutes,
    a.scored_draw_minutes,
    a.leading_minutes,
    a.trailing_minutes,
    a.comeback_equalizers,
    a.leads_taken,
        CASE
            WHEN a.duration > 0::numeric THEN round(a.leading_minutes * 100::numeric / a.duration, 2)
            ELSE NULL::numeric
        END AS lead_pct,
        CASE
            WHEN a.duration > 0::numeric THEN round(a.trailing_minutes * 100::numeric / a.duration, 2)
            ELSE NULL::numeric
        END AS trail_pct,
        CASE
            WHEN a.duration > 0::numeric THEN round(a.nil_minutes * 100::numeric / a.duration, 2)
            ELSE NULL::numeric
        END AS nil_pct
   FROM totals t
     LEFT JOIN aggregates a ON a.season_id = t.season_id AND a.competition_id = t.competition_id AND a.team_key = t.team_key;
GRANT SELECT ON public.app_tournament_team_flow TO anon,authenticated;
NOTIFY pgrst,'reload schema';
