-- Fix tournament comparisons without granting public access to private player participation.
-- Preserve per-match overrides and confirmed stoppage recoveries.
-- Canonical match-flow minutes and event-context statistics, recalculated from verified events.
CREATE OR REPLACE VIEW public.app_match_flow_numbers WITH (security_invoker=true) AS
 WITH match_period_ends AS (
         SELECT DISTINCT ON (e.match_id, period.period_no)
            e.match_id, period.period_no,
            GREATEST(0::numeric, COALESCE(
               CASE WHEN e.payload->>'recovery_actual' ~ '^[0-9]+$' THEN (e.payload->>'recovery_actual')::numeric END,
               CASE WHEN e.payload->>'recovery_minutes' ~ '^[0-9]+$' THEN (e.payload->>'recovery_minutes')::numeric END,
               e.stoppage_minute::numeric, 0::numeric
            )) AS recovery
           FROM app_match_events e
           CROSS JOIN LATERAL (VALUES (COALESCE(
              CASE e.payload->>'period' WHEN 'first_half' THEN 1 WHEN 'second_half' THEN 2 END,
              CASE WHEN e.payload->>'period_no' ~ '^[0-9]+$' THEN (e.payload->>'period_no')::integer END
           ))) AS period(period_no)
          WHERE e.event_type = 'period_end'
            AND e.validation_status IN ('official','community_confirmed')
            AND period.period_no IN (1,2)
          ORDER BY e.match_id, period.period_no,
            (e.payload->>'recovery_actual' IS NOT NULL) DESC,
            (e.payload->>'entered_from' = 'period_control') DESC,
            e.created_at DESC NULLS LAST, e.id DESC
        ), match_recovery AS (
         SELECT match_id, sum(recovery) AS total_recovery
           FROM match_period_ends
          GROUP BY match_id
        ), base AS (
         SELECT m.id AS match_id,
            m.season_id,
            m.competition_id,
            ((COALESCE(NULLIF(m.minutes_per_period_override,0),NULLIF(c.minutes_per_period,0),40)
               * COALESCE(NULLIF(m.periods_override,0),NULLIF(c.periods,0),2))::numeric
               + COALESCE(r.total_recovery,0)::numeric) AS duration,
            ( SELECT bool_and(g.verified) AS bool_and
                   FROM app_goal_context g
                  WHERE g.match_id = m.id) AS goals_verified,
            f.home_score,
            f.away_score
           FROM app_matches m
             JOIN app_competition_fixtures f ON f.id = m.fixture_id
             JOIN app_competitions c ON c.id = m.competition_id
             LEFT JOIN match_recovery r ON r.match_id = m.id
          WHERE m.status = 'finished'::text AND NOT m.is_test
        ), goals AS (
         SELECT g.season_id,
            g.competition_id,
            g.match_id,
            g.event_id,
            g.player_id,
            g.scoring_side,
            g.elapsed,
            g.before_gf,
            g.before_ga,
            g.after_gf,
            g.after_ga,
            g.verified,
            g.opener_or_lead,
            g.equalizer,
            g.go_ahead,
            g.scored_while_trailing,
            g.reduced_deficit,
            g.extended_lead,
            g.go_ahead_after_equal,
            g.comeback_equalizer,
            lead(g.elapsed) OVER (PARTITION BY g.match_id ORDER BY g.elapsed, g.event_id) AS next_minute,
            row_number() OVER (PARTITION BY g.match_id ORDER BY g.elapsed, g.event_id) AS seq
           FROM app_goal_context g
             JOIN base b_1 ON b_1.match_id = g.match_id
          WHERE g.verified
        ), segments AS (
         SELECT b_1.match_id,
            b_1.duration,
            0::numeric AS start_minute,
            COALESCE(( SELECT min(g.elapsed) AS min
                   FROM goals g
                  WHERE g.match_id = b_1.match_id), b_1.duration) AS end_minute,
            0::bigint AS gf,
            0::bigint AS ga
           FROM base b_1
          WHERE b_1.goals_verified IS TRUE OR b_1.home_score = 0 AND b_1.away_score = 0
        UNION ALL
         SELECT g.match_id,
            b_1.duration,
            g.elapsed,
            COALESCE(g.next_minute, b_1.duration) AS "coalesce",
            g.after_gf,
            g.after_ga
           FROM goals g
             JOIN base b_1 ON b_1.match_id = g.match_id
        ), time_totals AS (
         SELECT segments.match_id,
            sum(GREATEST(0::numeric, LEAST(segments.duration, segments.end_minute) - segments.start_minute)) FILTER (WHERE segments.gf = 0 AND segments.ga = 0) AS nil_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.duration, segments.end_minute) - segments.start_minute)) FILTER (WHERE segments.gf = segments.ga) AS draw_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.duration, segments.end_minute) - segments.start_minute)) FILTER (WHERE segments.gf > segments.ga) AS lead_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.duration, segments.end_minute) - segments.start_minute)) FILTER (WHERE segments.gf < segments.ga) AS trail_minutes
           FROM segments
          GROUP BY segments.match_id
        ), progress AS (
         SELECT goals.match_id,
            count(*) FILTER (WHERE goals.scoring_side = 'team'::text) AS goals_for,
            count(*) FILTER (WHERE goals.scoring_side = 'opponent'::text) AS goals_against,
            count(*) FILTER (WHERE goals.scoring_side = 'team'::text AND goals.before_gf < goals.before_ga AND goals.after_gf = goals.after_ga) AS comeback_equalizers,
            count(*) FILTER (WHERE goals.scoring_side = 'team'::text AND goals.before_gf = goals.before_ga AND goals.after_gf > goals.after_ga) AS leads_taken,
            count(*) FILTER (WHERE goals.scoring_side = 'opponent'::text AND goals.before_gf > goals.before_ga AND goals.after_gf <= goals.after_ga) AS leads_lost,
            count(*) FILTER (WHERE goals.scoring_side = 'team'::text AND goals.before_gf < goals.before_ga AND goals.after_gf >= goals.after_ga) AS deficits_recovered,
            count(*) FILTER (WHERE goals.scoring_side = 'opponent'::text AND goals.before_gf >= goals.before_ga AND goals.after_gf < goals.after_ga) AS deficits_entered,
            count(*) FILTER (WHERE goals.scoring_side = 'opponent'::text AND goals.before_gf > goals.before_ga AND goals.after_gf = goals.after_ga) AS opponent_equalizers,
            count(*) FILTER (WHERE goals.scoring_side = 'team'::text AND goals.before_gf > goals.before_ga) AS lead_extensions,
            count(*) FILTER (WHERE goals.scoring_side = 'opponent'::text AND goals.before_gf < goals.before_ga) AS opponent_lead_extensions
           FROM goals
          GROUP BY goals.match_id
        ), match_events AS (
         SELECT e_1.match_id,
            count(*) FILTER (WHERE e_1.event_type = 'substitution'::text AND (e_1.team_side = ANY (ARRAY['team'::text, 'home'::text, 'away'::text, 'opponent'::text]))) AS substitutions_total,
            count(*) FILTER (WHERE e_1.event_type = 'yellow_card'::text) AS yellows_total,
            count(*) FILTER (WHERE e_1.event_type = ANY (ARRAY['red_card'::text, 'second_yellow'::text])) AS reds_total
           FROM app_match_events e_1
          WHERE e_1.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text])
          GROUP BY e_1.match_id
        )
 SELECT b.match_id,
    b.season_id,
    b.competition_id,
    b.duration,
    b.goals_verified IS TRUE OR b.home_score = 0 AND b.away_score = 0 AND NOT (EXISTS ( SELECT 1
           FROM app_goal_context g
          WHERE g.match_id = b.match_id)) AS verified,
        CASE
            WHEN b.goals_verified IS TRUE OR b.home_score = 0 AND b.away_score = 0 THEN round(COALESCE(t.nil_minutes, 0::numeric), 2)
            ELSE NULL::numeric
        END AS nil_minutes,
        CASE
            WHEN b.goals_verified IS TRUE OR b.home_score = 0 AND b.away_score = 0 THEN round(COALESCE(t.draw_minutes, 0::numeric), 2)
            ELSE NULL::numeric
        END AS draw_minutes,
        CASE
            WHEN b.goals_verified IS TRUE OR b.home_score = 0 AND b.away_score = 0 THEN round(COALESCE(t.lead_minutes, 0::numeric), 2)
            ELSE NULL::numeric
        END AS lead_minutes,
        CASE
            WHEN b.goals_verified IS TRUE OR b.home_score = 0 AND b.away_score = 0 THEN round(COALESCE(t.trail_minutes, 0::numeric), 2)
            ELSE NULL::numeric
        END AS trail_minutes,
    COALESCE(p.goals_for, 0::bigint)::integer AS goals_for,
    COALESCE(p.goals_against, 0::bigint)::integer AS goals_against,
    COALESCE(p.comeback_equalizers, 0::bigint)::integer AS comeback_equalizers,
    COALESCE(p.leads_taken, 0::bigint)::integer AS leads_taken,
    COALESCE(p.leads_lost, 0::bigint)::integer AS leads_lost,
    COALESCE(p.deficits_recovered, 0::bigint)::integer AS deficits_recovered,
    COALESCE(p.deficits_entered, 0::bigint)::integer AS deficits_entered,
    COALESCE(p.opponent_equalizers, 0::bigint)::integer AS opponent_equalizers,
    COALESCE(e.substitutions_total, 0::bigint)::integer AS substitutions_total,
    COALESCE(e.yellows_total, 0::bigint)::integer AS yellows_total,
    COALESCE(e.reds_total, 0::bigint)::integer AS reds_total
   FROM base b
     LEFT JOIN time_totals t ON t.match_id = b.match_id
     LEFT JOIN progress p ON p.match_id = b.match_id
     LEFT JOIN match_events e ON e.match_id = b.match_id;
GRANT SELECT ON public.app_match_flow_numbers TO anon,authenticated;
NOTIFY pgrst,'reload schema';
