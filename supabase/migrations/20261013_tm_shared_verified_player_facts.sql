-- Canonical match-player participation / player season totals.
-- Source: live schema, verified on 2026-10-13. All definitions are CREATE OR REPLACE.
-- No historical event, match or player records are modified.
SET search_path = public, private;

CREATE OR REPLACE VIEW private.tm_player_match_participation AS
WITH base AS (
         SELECT m.id AS match_id,
            m.season_id,
            m.home_away,
            COALESCE(NULLIF(m.minutes_per_period_override, 0)::integer, NULLIF(c_1.minutes_per_period, 0)::integer, 40)::numeric AS half,
            COALESCE(NULLIF(m.periods_override, 0)::integer, NULLIF(c_1.periods, 0)::integer, 2) AS periods
           FROM app_matches m
             LEFT JOIN app_competitions c_1 ON c_1.id = m.competition_id
          WHERE m.status = 'finished'::text AND NOT m.is_test
        ), period_ends AS (
         SELECT DISTINCT ON (e.match_id, (COALESCE(
                CASE e.payload ->> 'period'::text
                    WHEN 'first_half'::text THEN 1
                    WHEN 'second_half'::text THEN 2
                    ELSE NULL::integer
                END,
                CASE
                    WHEN (e.payload ->> 'period_no'::text) ~ '^[0-9]+$'::text THEN (e.payload ->> 'period_no'::text)::integer
                    ELSE NULL::integer
                END))) e.match_id,
            COALESCE(
                CASE e.payload ->> 'period'::text
                    WHEN 'first_half'::text THEN 1
                    WHEN 'second_half'::text THEN 2
                    ELSE NULL::integer
                END,
                CASE
                    WHEN (e.payload ->> 'period_no'::text) ~ '^[0-9]+$'::text THEN (e.payload ->> 'period_no'::text)::integer
                    ELSE NULL::integer
                END) AS pno,
            GREATEST(0::numeric, COALESCE(
                CASE
                    WHEN (e.payload ->> 'recovery_actual'::text) ~ '^[0-9]+$'::text THEN (e.payload ->> 'recovery_actual'::text)::numeric
                    ELSE NULL::numeric
                END,
                CASE
                    WHEN (e.payload ->> 'recovery_minutes'::text) ~ '^[0-9]+$'::text THEN (e.payload ->> 'recovery_minutes'::text)::numeric
                    ELSE NULL::numeric
                END, e.stoppage_minute::numeric, 0::numeric)) AS recovery
           FROM app_match_events e
             JOIN base b ON b.match_id = e.match_id
          WHERE e.event_type = 'period_end'::text AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))
          ORDER BY e.match_id, (COALESCE(
                CASE e.payload ->> 'period'::text
                    WHEN 'first_half'::text THEN 1
                    WHEN 'second_half'::text THEN 2
                    ELSE NULL::integer
                END,
                CASE
                    WHEN (e.payload ->> 'period_no'::text) ~ '^[0-9]+$'::text THEN (e.payload ->> 'period_no'::text)::integer
                    ELSE NULL::integer
                END)), e.created_at DESC NULLS LAST, e.id DESC
        ), rec AS (
         SELECT period_ends.match_id,
            COALESCE(max(period_ends.recovery) FILTER (WHERE period_ends.pno = 1), 0::numeric) AS rec1,
            COALESCE(max(period_ends.recovery) FILTER (WHERE period_ends.pno = 2), 0::numeric) AS rec2
           FROM period_ends
          GROUP BY period_ends.match_id
        ), cfg AS (
         SELECT b.match_id,
            b.season_id,
            b.home_away,
            b.half,
            b.periods,
            COALESCE(r.rec1, 0::numeric) AS rec1,
            COALESCE(r.rec2, 0::numeric) AS rec2,
            b.half * b.periods::numeric + COALESCE(r.rec1, 0::numeric) + COALESCE(r.rec2, 0::numeric) AS duration
           FROM base b
             LEFT JOIN rec r ON r.match_id = b.match_id
        ), team_events AS (
         SELECT e.id,
            e.match_id,
            e.event_type,
            e.player_id,
            e.secondary_player_id,
            e.created_at,
            e.payload,
            c_1.duration,
                CASE
                    WHEN (e.payload ->> 'period'::text) = 'halftime'::text THEN c_1.half + c_1.rec1
                    WHEN e.minute IS NULL THEN NULL::numeric
                    ELSE e.minute::numeric +
                    CASE
                        WHEN (e.payload ->> 'period'::text) = 'second_half'::text AND COALESCE(e.payload ->> 'minute_relative'::text, 'true'::text) <> 'false'::text AND COALESCE(e.payload ->> 'entered_from'::text, ''::text) <> 'tm_app_live'::text THEN c_1.half
                        ELSE 0::numeric
                    END +
                    CASE
                        WHEN (e.payload ->> 'period'::text) = 'second_half'::text OR (e.payload ->> 'period_no'::text) = '2'::text OR e.minute::numeric > c_1.half AND COALESCE(e.payload ->> 'period'::text, ''::text) <> 'first_half'::text THEN c_1.rec1
                        ELSE 0::numeric
                    END + GREATEST(0, COALESCE(e.stoppage_minute::integer, 0))::numeric
                END AS t
           FROM app_match_events e
             JOIN cfg c_1 ON c_1.match_id = e.match_id
          WHERE (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text])) AND (e.event_type = ANY (ARRAY['substitution'::text, 'red_card'::text, 'second_yellow'::text, 'blue_card'::text, 'blue_return'::text, 'temporary_return'::text, 'return_from_blue'::text])) AND (e.team_side = 'team'::text OR e.team_side = 'home'::text AND c_1.home_away = 'home'::text OR e.team_side = 'away'::text AND c_1.home_away = 'away'::text)
        ), match_bad AS (
         SELECT e.match_id,
            bool_or(e.t IS NULL OR e.t < 0::numeric OR e.t > e.duration OR e.event_type = 'substitution'::text AND (e.player_id IS NULL OR e.secondary_player_id IS NULL OR e.player_id = e.secondary_player_id OR NOT (EXISTS ( SELECT 1
                   FROM app_match_players mp_1
                  WHERE mp_1.match_id = e.match_id AND mp_1.player_id = e.player_id)) OR NOT (EXISTS ( SELECT 1
                   FROM app_match_players mp_1
                  WHERE mp_1.match_id = e.match_id AND mp_1.player_id = e.secondary_player_id))) OR e.event_type <> 'substitution'::text AND (e.player_id IS NULL OR NOT (EXISTS ( SELECT 1
                   FROM app_match_players mp_1
                  WHERE mp_1.match_id = e.match_id AND mp_1.player_id = e.player_id)))) AS bad
           FROM team_events e
          GROUP BY e.match_id
        ), actions AS (
         SELECT mp_1.match_id,
            mp_1.player_id,
            0::numeric AS t,
            'in'::text AS action,
            0 AS ord,
            NULL::timestamp with time zone AS created_at,
            NULL::uuid AS event_id
           FROM app_match_players mp_1
             JOIN cfg c_1 ON c_1.match_id = mp_1.match_id
          WHERE mp_1.started = true
        UNION ALL
         SELECT e.match_id,
            e.player_id,
            e.t,
            'out'::text,
            1,
            e.created_at,
            e.id
           FROM team_events e
          WHERE e.player_id IS NOT NULL AND (e.event_type = ANY (ARRAY['substitution'::text, 'red_card'::text, 'second_yellow'::text, 'blue_card'::text]))
        UNION ALL
         SELECT e.match_id,
            e.secondary_player_id,
            e.t,
            'in'::text,
            2,
            e.created_at,
            e.id
           FROM team_events e
          WHERE e.secondary_player_id IS NOT NULL AND e.event_type = 'substitution'::text
        UNION ALL
         SELECT e.match_id,
            e.player_id,
            e.t,
            'in'::text,
            2,
            e.created_at,
            e.id
           FROM team_events e
          WHERE e.player_id IS NOT NULL AND (e.event_type = ANY (ARRAY['blue_return'::text, 'temporary_return'::text, 'return_from_blue'::text]))
        ), ordered AS (
         SELECT a.match_id,
            a.player_id,
            a.t,
            a.action,
            a.ord,
            a.created_at,
            a.event_id,
            lag(a.action) OVER w AS prev_action,
            lead(a.t) OVER w AS next_t
           FROM actions a
          WINDOW w AS (PARTITION BY a.match_id, a.player_id ORDER BY a.t, a.ord, a.created_at NULLS FIRST, a.event_id)
        ), player_totals AS (
         SELECT o.match_id,
            o.player_id,
            sum(
                CASE
                    WHEN o.action = 'in'::text THEN GREATEST(0::numeric, COALESCE(o.next_t, c_1.duration) - o.t)
                    ELSE 0::numeric
                END) AS mins,
            bool_or(o.t IS NULL OR o.t < 0::numeric OR o.t > c_1.duration OR o.prev_action IS NULL AND o.action <> 'in'::text OR o.prev_action IS NOT NULL AND o.prev_action = o.action) AS bad
           FROM ordered o
             JOIN cfg c_1 ON c_1.match_id = o.match_id
          GROUP BY o.match_id, o.player_id
        ), entrances AS (
         SELECT e.match_id,
            e.secondary_player_id AS player_id,
            count(*) AS n
           FROM team_events e
          WHERE e.event_type = 'substitution'::text AND e.secondary_player_id IS NOT NULL
          GROUP BY e.match_id, e.secondary_player_id
        )
 SELECT c.season_id,
    mp.match_id,
    mp.player_id,
    mp.started,
    mp.started OR COALESCE(en.n, 0::bigint) > 0 AS appeared,
    NOT mp.started AND COALESCE(en.n, 0::bigint) > 0 AS subentered,
        CASE
            WHEN c.periods <> 2 OR COALESCE(mb.bad, false) OR COALESCE(pt.bad, false) OR mp.minutes_played IS NOT NULL AND abs(COALESCE(pt.mins, 0::numeric) - mp.minutes_played::numeric) > 2::numeric THEN NULL::integer
            ELSE round(COALESCE(pt.mins, 0::numeric))::integer
        END AS minutes,
        CASE
            WHEN c.periods <> 2 OR COALESCE(mb.bad, false) OR COALESCE(pt.bad, false) OR mp.minutes_played IS NOT NULL AND abs(COALESCE(pt.mins, 0::numeric) - mp.minutes_played::numeric) > 2::numeric THEN false
            ELSE true
        END AS valid,
    c.duration
   FROM cfg c
     JOIN app_match_players mp ON mp.match_id = c.match_id
     LEFT JOIN player_totals pt ON pt.match_id = mp.match_id AND pt.player_id = mp.player_id
     LEFT JOIN entrances en ON en.match_id = mp.match_id AND en.player_id = mp.player_id
     LEFT JOIN match_bad mb ON mb.match_id = mp.match_id;

CREATE OR REPLACE VIEW private.tm_player_season_participation AS
SELECT season_id,
    player_id,
    count(*) FILTER (WHERE appeared)::integer AS appearances,
    count(*) FILTER (WHERE started)::integer AS starts,
    count(*) FILTER (WHERE subentered)::integer AS subentries,
    bool_and(valid AND minutes IS NOT NULL) FILTER (WHERE appeared) AS complete,
    sum(minutes) FILTER (WHERE appeared)::integer AS minutes,
    count(*) FILTER (WHERE appeared AND NOT valid)::integer AS invalid_appearances
   FROM private.tm_player_match_participation
  GROUP BY season_id, player_id;

CREATE OR REPLACE VIEW public.app_player_season_stats AS
WITH mp AS (
         SELECT m.season_id,
            x.player_id,
            count(DISTINCT x.match_id) FILTER (WHERE m.status = 'finished'::text AND (x.started OR (EXISTS ( SELECT 1
                   FROM app_match_events se
                  WHERE se.match_id = x.match_id AND se.event_type = 'substitution'::text AND se.secondary_player_id = x.player_id AND (se.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))))))::integer AS appearances,
            count(DISTINCT x.match_id) FILTER (WHERE m.status = 'finished'::text AND x.started AND (m.lineup_confirmed_at IS NOT NULL OR m.kickoff_at < '2026-10-03 22:00:00+00'::timestamp with time zone))::integer AS starts,
            COALESCE(sum(x.minutes_played) FILTER (WHERE m.status = 'finished'::text), 0::bigint)::integer AS minutes
           FROM app_match_players x
             JOIN ( SELECT app_matches.id,
                    app_matches.season_id,
                    app_matches.competition_id,
                    app_matches.opponent_id,
                    app_matches.kickoff_at,
                    app_matches.venue,
                    app_matches.home_away,
                    app_matches.round_label,
                    app_matches.status,
                    app_matches.home_score,
                    app_matches.away_score,
                    app_matches.live_started_at,
                    app_matches.finalized_at,
                    app_matches.created_at,
                    app_matches.notes,
                    app_matches.live_period,
                    app_matches.formation,
                    app_matches.venue_name,
                    app_matches.venue_address,
                    app_matches.fixture_id,
                    app_matches.live_clock_seconds,
                    app_matches.live_clock_anchor,
                    app_matches.live_clock_running,
                    app_matches.result_review_status,
                    app_matches.result_reviewed_at,
                    app_matches.result_reviewed_by,
                    app_matches.lineup_confirmed_at,
                    app_matches.lineup_confirmed_by,
                    app_matches.match_kit_key,
                    app_matches.live_clock_estimated,
                    app_matches.live_period_started_at,
                    app_matches.live_period_start_estimated,
                    app_matches.is_test,
                    app_matches.test_owner_id
                   FROM app_matches
                  WHERE NOT app_matches.is_test) m ON m.id = x.match_id
          GROUP BY m.season_id, x.player_id
        ), event_source AS (
         SELECT m.season_id,
            e.id,
            e.match_id,
            e.event_type,
            e.minute,
            e.stoppage_minute,
            e.player_id,
            e.secondary_player_id,
            e.payload,
            e.proposed_by,
            e.validation_status,
            e.officialized_by,
            e.officialized_at,
            e.created_at,
            e.team_side,
            e.substitution_reason,
            e.source,
            e.source_event_key,
            e.source_raw
           FROM app_match_events e
             JOIN ( SELECT app_matches.id,
                    app_matches.season_id,
                    app_matches.competition_id,
                    app_matches.opponent_id,
                    app_matches.kickoff_at,
                    app_matches.venue,
                    app_matches.home_away,
                    app_matches.round_label,
                    app_matches.status,
                    app_matches.home_score,
                    app_matches.away_score,
                    app_matches.live_started_at,
                    app_matches.finalized_at,
                    app_matches.created_at,
                    app_matches.notes,
                    app_matches.live_period,
                    app_matches.formation,
                    app_matches.venue_name,
                    app_matches.venue_address,
                    app_matches.fixture_id,
                    app_matches.live_clock_seconds,
                    app_matches.live_clock_anchor,
                    app_matches.live_clock_running,
                    app_matches.result_review_status,
                    app_matches.result_reviewed_at,
                    app_matches.result_reviewed_by,
                    app_matches.lineup_confirmed_at,
                    app_matches.lineup_confirmed_by,
                    app_matches.match_kit_key,
                    app_matches.live_clock_estimated,
                    app_matches.live_period_started_at,
                    app_matches.live_period_start_estimated,
                    app_matches.is_test,
                    app_matches.test_owner_id
                   FROM app_matches
                  WHERE NOT app_matches.is_test) m ON m.id = e.match_id
          WHERE m.status = 'finished'::text AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))
        ), ev AS (
         SELECT e.season_id,
            e.player_id,
            count(*) FILTER (WHERE (e.event_type = ANY (ARRAY['goal'::text, 'penalty_scored'::text])) AND e.team_side = 'team'::text)::integer AS goals,
            count(*) FILTER (WHERE e.event_type = 'yellow_card'::text)::integer AS yellow_cards,
            count(*) FILTER (WHERE e.event_type = 'red_card'::text)::integer AS red_cards,
            count(*) FILTER (WHERE e.event_type = 'blue_card'::text)::integer AS blue_cards,
            count(*) FILTER (WHERE e.event_type = ANY (ARRAY['yellow_card'::text, 'blue_card'::text]))::integer AS disciplinary_cards
           FROM event_source e
          WHERE e.player_id IS NOT NULL
          GROUP BY e.season_id, e.player_id
        ), all_assists AS (
         SELECT e.season_id,
            e.secondary_player_id AS player_id,
            e.id
           FROM event_source e
          WHERE (e.event_type = ANY (ARRAY['goal'::text, 'penalty_scored'::text])) AND e.team_side = 'team'::text AND e.secondary_player_id IS NOT NULL
        UNION ALL
         SELECT e.season_id,
            e.player_id,
            e.id
           FROM event_source e
          WHERE e.event_type = 'assist'::text AND e.player_id IS NOT NULL AND NOT (EXISTS ( SELECT 1
                   FROM event_source g
                  WHERE g.match_id = e.match_id AND (g.event_type = ANY (ARRAY['goal'::text, 'penalty_scored'::text])) AND g.secondary_player_id = e.player_id AND NOT g.minute IS DISTINCT FROM e.minute AND NOT g.stoppage_minute IS DISTINCT FROM e.stoppage_minute))
        ), asst AS (
         SELECT all_assists.season_id,
            all_assists.player_id,
            count(DISTINCT all_assists.id)::integer AS assists
           FROM all_assists
          GROUP BY all_assists.season_id, all_assists.player_id
        ), rated_matches AS (
         SELECT m.season_id,
            r.player_id,
            r.match_id,
            avg(r.rating) AS match_mean
           FROM app_match_ratings r
             JOIN ( SELECT app_matches.id,
                    app_matches.season_id,
                    app_matches.competition_id,
                    app_matches.opponent_id,
                    app_matches.kickoff_at,
                    app_matches.venue,
                    app_matches.home_away,
                    app_matches.round_label,
                    app_matches.status,
                    app_matches.home_score,
                    app_matches.away_score,
                    app_matches.live_started_at,
                    app_matches.finalized_at,
                    app_matches.created_at,
                    app_matches.notes,
                    app_matches.live_period,
                    app_matches.formation,
                    app_matches.venue_name,
                    app_matches.venue_address,
                    app_matches.fixture_id,
                    app_matches.live_clock_seconds,
                    app_matches.live_clock_anchor,
                    app_matches.live_clock_running,
                    app_matches.result_review_status,
                    app_matches.result_reviewed_at,
                    app_matches.result_reviewed_by,
                    app_matches.lineup_confirmed_at,
                    app_matches.lineup_confirmed_by,
                    app_matches.match_kit_key,
                    app_matches.live_clock_estimated,
                    app_matches.live_period_started_at,
                    app_matches.live_period_start_estimated,
                    app_matches.is_test,
                    app_matches.test_owner_id
                   FROM app_matches
                  WHERE NOT app_matches.is_test) m ON m.id = r.match_id
          WHERE m.status = 'finished'::text
          GROUP BY m.season_id, r.player_id, r.match_id
        ), rt AS (
         SELECT rated_matches.season_id,
            rated_matches.player_id,
            round(avg(rated_matches.match_mean), 2) AS avg_rating
           FROM rated_matches
          GROUP BY rated_matches.season_id, rated_matches.player_id
        )
 SELECT ar.season_id,
    p.id AS player_id,
    p.first_name,
    p.last_name,
    p.generic_role_manual AS position_group,
    COALESCE(mp.appearances, 0) AS appearances,
    COALESCE(mp.starts, 0) AS starts,
        CASE
            WHEN COALESCE(mp.appearances, 0) = 0 THEN 0
            WHEN ss.appearances = mp.appearances AND ss.starts = mp.starts AND ss.complete IS TRUE THEN ss.minutes
            ELSE NULL::integer
        END AS minutes,
    COALESCE(ev.goals, 0) AS goals,
    COALESCE(asst.assists, 0) AS assists,
    COALESCE(ev.yellow_cards, 0) AS yellow_cards,
    COALESCE(ev.red_cards, 0) AS red_cards,
    rt.avg_rating,
    COALESCE(ev.blue_cards, 0) AS blue_cards,
    COALESCE(ev.disciplinary_cards, 0) AS disciplinary_cards,
        CASE
            WHEN COALESCE(mp.appearances, 0) = 0 THEN 0
            WHEN ss.appearances = mp.appearances AND ss.starts = mp.starts AND ss.complete IS TRUE THEN ss.subentries
            ELSE NULL::integer
        END AS subentries,
        CASE
            WHEN COALESCE(mp.appearances, 0) = 0 THEN 'not_applicable'::text
            WHEN ss.appearances = mp.appearances AND ss.starts = mp.starts AND ss.complete IS TRUE THEN 'complete'::text
            ELSE 'unavailable'::text
        END AS minutes_coverage
   FROM app_roster ar
     JOIN players p ON p.id = ar.player_id
     LEFT JOIN mp ON mp.season_id = ar.season_id AND mp.player_id = p.id
     LEFT JOIN ev ON ev.season_id = ar.season_id AND ev.player_id = p.id
     LEFT JOIN asst ON asst.season_id = ar.season_id AND asst.player_id = p.id
     LEFT JOIN rt ON rt.season_id = ar.season_id AND rt.player_id = p.id
     LEFT JOIN private.tm_player_season_participation ss ON ss.season_id = ar.season_id AND ss.player_id = p.id;

CREATE OR REPLACE FUNCTION public.tm_app_public_weighted_rating(p_match_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH validated AS (
 SELECT p.player_id,p.minutes
 FROM private.tm_player_match_participation p
 JOIN public.app_matches m ON m.id=p.match_id
 WHERE p.match_id=p_match_id AND NOT m.is_test AND m.status='finished' AND p.appeared
),
votes AS (
 SELECT player_id,avg(rating)::numeric avg_rating
 FROM public.app_match_ratings
 WHERE match_id=p_match_id AND rating BETWEEN 1 AND 10
 GROUP BY player_id
)
SELECT CASE
 WHEN EXISTS (SELECT 1 FROM validated WHERE minutes IS NULL)
   OR NOT EXISTS (SELECT 1 FROM validated)
 THEN NULL
 WHEN sum(v.avg_rating*p.minutes) IS NOT NULL AND sum(p.minutes)>0
 THEN round(sum(v.avg_rating*p.minutes)/sum(p.minutes),2)
 ELSE NULL END
FROM validated p JOIN votes v ON v.player_id=p.player_id
$function$
REVOKE ALL ON FUNCTION public.tm_app_public_weighted_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_app_public_weighted_rating(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
RESET search_path;
