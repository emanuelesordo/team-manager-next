-- Verified score progressions for fixtures without an app_matches record.
-- Includes only official confirmed goals whose sides, counts and elapsed times match the final result.
CREATE OR REPLACE VIEW public.app_fixture_tournament_flow WITH (security_invoker=true) AS
 WITH fixtures AS (
         SELECT f.id AS fixture_id,
            f.season_id,
            f.competition_id,
            f.home_team,
            f.away_team,
            f.home_score,
            f.away_score,
            GREATEST(1, COALESCE(c_1.minutes_per_period::integer, 40) * COALESCE(c_1.periods::integer, 2))::numeric AS duration
           FROM app_competition_fixtures f
             JOIN app_competitions c_1 ON c_1.id = f.competition_id
          WHERE f.status = 'finished'::text AND NOT f.is_test AND NOT (EXISTS ( SELECT 1
                   FROM app_matches m
                  WHERE m.fixture_id = f.id AND NOT m.is_test))
        ), goals AS (
         SELECT f.fixture_id,
            f.season_id,
            f.competition_id,
            f.home_team,
            f.away_team,
            f.home_score,
            f.away_score,
            f.duration,
            e.id AS event_id,
            e.event_type,
            e.team_side,
            e.created_at,
                CASE
                    WHEN e.minute IS NULL THEN NULL::numeric
                    WHEN (e.payload ->> 'period'::text) = 'second_half'::text AND e.minute::numeric <= (f.duration / 2::numeric) AND COALESCE(e.source, ''::text) <> 'csi'::text THEN e.minute::numeric + f.duration / 2::numeric + GREATEST(0, COALESCE(e.stoppage_minute::integer, 0))::numeric
                    ELSE (e.minute + GREATEST(0, COALESCE(e.stoppage_minute::integer, 0)))::numeric
                END AS elapsed,
                CASE
                    WHEN e.event_type = 'own_goal'::text THEN
                    CASE
                        WHEN e.team_side = 'home'::text THEN 'away'::text
                        WHEN e.team_side = 'away'::text THEN 'home'::text
                        ELSE NULL::text
                    END
                    ELSE e.team_side
                END AS scorer
           FROM fixtures f
             JOIN app_match_events e ON e.fixture_id = f.fixture_id AND e.match_id IS NULL
          WHERE (e.event_type = ANY (ARRAY['goal'::text, 'own_goal'::text, 'penalty_goal'::text, 'penalty_scored'::text])) AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text])) AND COALESCE(e.payload ->> 'count_score'::text, 'true'::text) <> 'false'::text
        ), good AS (
         SELECT f.fixture_id,
            f.season_id,
            f.competition_id,
            f.home_team,
            f.away_team,
            f.home_score,
            f.away_score,
            f.duration,
            count(g.event_id) AS goals_count,
            count(g.event_id) FILTER (WHERE g.scorer = 'home'::text) AS home_goals,
            count(g.event_id) FILTER (WHERE g.scorer = 'away'::text) AS away_goals,
            count(g.event_id) FILTER (WHERE g.elapsed IS NULL OR g.elapsed < 0::numeric OR g.elapsed > (f.duration + 20::numeric) OR g.scorer IS NULL) AS unknown
           FROM fixtures f
             LEFT JOIN goals g ON g.fixture_id = f.fixture_id
          GROUP BY f.fixture_id, f.season_id, f.competition_id, f.home_team, f.away_team, f.home_score, f.away_score, f.duration
        ), reliable AS (
         SELECT good.fixture_id,
            good.season_id,
            good.competition_id,
            good.home_team,
            good.away_team,
            good.home_score,
            good.away_score,
            good.duration,
            good.goals_count,
            good.home_goals,
            good.away_goals,
            good.unknown
           FROM good
          WHERE good.unknown = 0 AND good.goals_count = (good.home_score + good.away_score) AND good.home_goals = good.home_score AND good.away_goals = good.away_score
        ), ordered AS (
         SELECT g.fixture_id,
            g.event_id,
            g.scorer,
            g.elapsed,
            g.created_at,
            count(*) FILTER (WHERE g.scorer = 'home'::text) OVER w AS after_home,
            count(*) FILTER (WHERE g.scorer = 'away'::text) OVER w AS after_away,
            lead(g.elapsed) OVER (PARTITION BY g.fixture_id ORDER BY g.elapsed, g.created_at, g.event_id) AS next_elapsed
           FROM goals g
             JOIN reliable r_1 ON r_1.fixture_id = g.fixture_id
          WINDOW w AS (PARTITION BY g.fixture_id ORDER BY g.elapsed, g.created_at, g.event_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        ), segments AS (
         SELECT r_1.fixture_id,
            0::numeric AS start_minute,
            COALESCE(( SELECT min(o.elapsed) AS min
                   FROM ordered o
                  WHERE o.fixture_id = r_1.fixture_id), r_1.duration) AS end_minute,
            0::bigint AS hg,
            0::bigint AS ag,
            r_1.duration
           FROM reliable r_1
        UNION ALL
         SELECT o.fixture_id,
            o.elapsed,
            COALESCE(o.next_elapsed, r_1.duration) AS "coalesce",
            o.after_home,
            o.after_away,
            r_1.duration
           FROM ordered o
             JOIN reliable r_1 ON r_1.fixture_id = o.fixture_id
        ), times AS (
         SELECT segments.fixture_id,
            sum(GREATEST(0::numeric, LEAST(segments.end_minute, segments.duration) - segments.start_minute)) FILTER (WHERE segments.hg = 0 AND segments.ag = 0) AS nil_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.end_minute, segments.duration) - segments.start_minute)) FILTER (WHERE segments.hg = segments.ag) AS draw_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.end_minute, segments.duration) - segments.start_minute)) FILTER (WHERE segments.hg > segments.ag) AS home_lead_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.end_minute, segments.duration) - segments.start_minute)) FILTER (WHERE segments.hg < segments.ag) AS away_lead_minutes,
            sum(GREATEST(0::numeric, LEAST(segments.end_minute, segments.duration) - segments.start_minute)) FILTER (WHERE abs(segments.hg - segments.ag) = 1) AS narrow_margin_minutes
           FROM segments
          GROUP BY segments.fixture_id
        ), transitions AS (
         SELECT ordered.fixture_id,
            count(*) FILTER (WHERE ordered.scorer = 'home'::text AND ordered.after_home = ordered.after_away AND ordered.after_home > 0) AS home_equalizers,
            count(*) FILTER (WHERE ordered.scorer = 'away'::text AND ordered.after_home = ordered.after_away AND ordered.after_away > 0) AS away_equalizers,
            count(*) FILTER (WHERE ordered.scorer = 'home'::text AND ordered.after_home = (ordered.after_away + 1)) AS home_go_aheads,
            count(*) FILTER (WHERE ordered.scorer = 'away'::text AND ordered.after_away = (ordered.after_home + 1)) AS away_go_aheads,
            count(*) FILTER (WHERE ordered.scorer = 'home'::text AND ordered.after_home = ordered.after_away AND ordered.after_home > 0 AND (ordered.after_home - 1) < ordered.after_away) AS home_comeback_equalizers,
            count(*) FILTER (WHERE ordered.scorer = 'away'::text AND ordered.after_away = ordered.after_home AND ordered.after_away > 0 AND (ordered.after_away - 1) < ordered.after_home) AS away_comeback_equalizers
           FROM ordered
          GROUP BY ordered.fixture_id
        ), cards AS (
         SELECT e.fixture_id,
            count(*) FILTER (WHERE e.event_type = 'substitution'::text) AS substitutions,
            count(*) FILTER (WHERE e.event_type = 'yellow_card'::text) AS yellows,
            count(*) FILTER (WHERE e.event_type = ANY (ARRAY['red_card'::text, 'second_yellow'::text])) AS reds
           FROM app_match_events e
          WHERE e.match_id IS NULL AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))
          GROUP BY e.fixture_id
        )
 SELECT r.fixture_id,
    r.season_id,
    r.competition_id,
    r.home_team,
    r.away_team,
    r.duration,
    round(COALESCE(t.nil_minutes, 0::numeric), 2) AS nil_minutes,
    round(COALESCE(t.draw_minutes, 0::numeric), 2) AS draw_minutes,
    round(COALESCE(t.home_lead_minutes, 0::numeric), 2) AS home_lead_minutes,
    round(COALESCE(t.away_lead_minutes, 0::numeric), 2) AS away_lead_minutes,
    round(COALESCE(t.narrow_margin_minutes, 0::numeric), 2) AS narrow_margin_minutes,
    COALESCE(tr.home_comeback_equalizers, 0::bigint)::integer AS home_comeback_equalizers,
    COALESCE(tr.away_comeback_equalizers, 0::bigint)::integer AS away_comeback_equalizers,
    COALESCE(tr.home_go_aheads, 0::bigint)::integer AS home_go_aheads,
    COALESCE(tr.away_go_aheads, 0::bigint)::integer AS away_go_aheads,
    COALESCE(c.substitutions, 0::bigint)::integer AS substitutions,
    COALESCE(c.yellows, 0::bigint)::integer AS yellows,
    COALESCE(c.reds, 0::bigint)::integer AS reds
   FROM reliable r
     JOIN times t ON t.fixture_id = r.fixture_id
     LEFT JOIN transitions tr ON tr.fixture_id = r.fixture_id
     LEFT JOIN cards c ON c.fixture_id = r.fixture_id;
GRANT SELECT ON public.app_fixture_tournament_flow TO anon,authenticated;
NOTIFY pgrst,'reload schema';