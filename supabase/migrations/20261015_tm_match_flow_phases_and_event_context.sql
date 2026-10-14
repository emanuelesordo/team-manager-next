-- Verified per-match scoreboard-phase proxies and event states.
CREATE OR REPLACE VIEW public.app_match_flow_phases WITH (security_invoker=true) AS
 WITH b AS (
         SELECT app_match_flow_numbers.match_id,
            app_match_flow_numbers.season_id,
            app_match_flow_numbers.competition_id,
            app_match_flow_numbers.duration
           FROM app_match_flow_numbers
          WHERE app_match_flow_numbers.verified AND app_match_flow_numbers.duration > 0::numeric
        ), g AS (
         SELECT app_goal_context.match_id,
            app_goal_context.event_id,
            app_goal_context.elapsed,
            app_goal_context.after_gf,
            app_goal_context.after_ga,
            lead(app_goal_context.elapsed) OVER (PARTITION BY app_goal_context.match_id ORDER BY app_goal_context.elapsed, app_goal_context.event_id) AS next_minute
           FROM app_goal_context
          WHERE app_goal_context.verified
        ), parts AS (
         SELECT b.match_id,
            b.season_id,
            b.competition_id,
            b.duration,
            0::numeric AS start_minute,
            COALESCE(min(g.elapsed), b.duration) AS end_minute,
            0::bigint AS gf,
            0::bigint AS ga
           FROM b
             LEFT JOIN g ON g.match_id = b.match_id
          GROUP BY b.match_id, b.season_id, b.competition_id, b.duration
        UNION ALL
         SELECT b.match_id,
            b.season_id,
            b.competition_id,
            b.duration,
            g.elapsed,
            COALESCE(g.next_minute, b.duration) AS "coalesce",
            g.after_gf,
            g.after_ga
           FROM b
             JOIN g ON g.match_id = b.match_id
        )
 SELECT match_id,
    season_id,
    competition_id,
    round(sum(GREATEST(0::numeric, LEAST(duration, end_minute) - start_minute)) FILTER (WHERE (gf - ga) = 1), 2) AS narrow_lead_minutes,
    round(sum(GREATEST(0::numeric, LEAST(duration, end_minute) - start_minute)) FILTER (WHERE (ga - gf) = 1), 2) AS narrow_deficit_minutes,
    round(sum(GREATEST(0::numeric, LEAST(duration, end_minute) - GREATEST(start_minute, duration * 0.75))) FILTER (WHERE (gf - ga) = 1), 2) AS late_narrow_lead_minutes,
    round(sum(GREATEST(0::numeric, LEAST(duration, end_minute) - GREATEST(start_minute, duration * 0.75))) FILTER (WHERE ga > gf), 2) AS late_trailing_minutes
   FROM parts
  GROUP BY match_id, season_id, competition_id;
GRANT SELECT ON public.app_match_flow_phases TO anon,authenticated;

CREATE OR REPLACE VIEW public.app_match_flow_event_context WITH (security_invoker=true) AS
 WITH entries AS (
         SELECT m.id AS match_id,
            m.season_id,
            m.competition_id,
            e_1.id AS event_id,
            e_1.event_type,
            tm_goal_elapsed(m.id, e_1.id) AS elapsed,
                CASE
                    WHEN e_1.team_side = ANY (ARRAY['team'::text, 'opponent'::text]) THEN e_1.team_side
                    WHEN e_1.team_side = 'home'::text THEN
                    CASE
                        WHEN m.home_away = 'home'::text THEN 'team'::text
                        ELSE 'opponent'::text
                    END
                    WHEN e_1.team_side = 'away'::text THEN
                    CASE
                        WHEN m.home_away = 'away'::text THEN 'team'::text
                        ELSE 'opponent'::text
                    END
                    ELSE NULL::text
                END AS event_side
           FROM app_match_events e_1
             JOIN app_matches m ON m.id = e_1.match_id
             JOIN app_match_flow_numbers f ON f.match_id = m.id AND f.verified
          WHERE (e_1.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text])) AND (e_1.event_type = ANY (ARRAY['substitution'::text, 'yellow_card'::text, 'red_card'::text, 'second_yellow'::text, 'blue_card'::text]))
        )
 SELECT e.match_id,
    e.season_id,
    e.competition_id,
    e.event_id,
    e.event_type,
    e.elapsed,
    e.event_side,
        CASE
            WHEN e.elapsed IS NULL THEN NULL::text
            WHEN COALESCE(g.after_gf, 0::bigint) > COALESCE(g.after_ga, 0::bigint) THEN 'leading'::text
            WHEN COALESCE(g.after_gf, 0::bigint) < COALESCE(g.after_ga, 0::bigint) THEN 'trailing'::text
            WHEN COALESCE(g.after_gf, 0::bigint) = 0 AND COALESCE(g.after_ga, 0::bigint) = 0 THEN 'nil'::text
            ELSE 'drawing'::text
        END AS score_state
   FROM entries e
     LEFT JOIN LATERAL ( SELECT g_1.after_gf,
            g_1.after_ga
           FROM app_goal_context g_1
          WHERE g_1.match_id = e.match_id AND g_1.verified AND g_1.elapsed <= e.elapsed
          ORDER BY g_1.elapsed DESC, g_1.event_id DESC
         LIMIT 1) g ON true;
GRANT SELECT ON public.app_match_flow_event_context TO anon,authenticated;

NOTIFY pgrst,'reload schema';