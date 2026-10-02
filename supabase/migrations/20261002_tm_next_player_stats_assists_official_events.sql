-- Align match secondary_player_id assists, legacy assist events, and validated goals. Already deployed.
CREATE OR REPLACE VIEW public.app_player_season_stats AS
 WITH mp AS (
         SELECT m.season_id,
            x.player_id,
            count(DISTINCT x.match_id) FILTER (WHERE m.status = 'finished'::text AND (x.started OR (EXISTS ( SELECT 1
                   FROM app_match_events se
                  WHERE se.match_id = x.match_id AND se.event_type = 'substitution'::text AND se.secondary_player_id = x.player_id AND (se.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))))))::integer AS appearances,
            count(DISTINCT x.match_id) FILTER (WHERE m.status = 'finished'::text AND x.started)::integer AS starts,
            COALESCE(sum(x.minutes_played) FILTER (WHERE m.status = 'finished'::text), 0::bigint)::integer AS minutes
           FROM app_match_players x
             JOIN app_matches m ON m.id = x.match_id
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
             JOIN app_matches m ON m.id = e.match_id
          WHERE m.status = 'finished'::text AND (e.validation_status = ANY (ARRAY['official'::text, 'community_confirmed'::text]))
        ), ev AS (
         SELECT e.season_id,
            e.player_id,
            count(*) FILTER (WHERE (e.event_type = ANY (ARRAY['goal'::text, 'penalty_scored'::text])) AND e.team_side = 'team'::text AND COALESCE(e.payload ->> 'goal_type'::text, ''::text) <> 'own_goal'::text)::integer AS goals,
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
          WHERE (e.event_type = ANY (ARRAY['goal'::text, 'penalty_scored'::text])) AND e.team_side = 'team'::text AND COALESCE(e.payload ->> 'goal_type'::text, ''::text) <> 'own_goal'::text AND e.secondary_player_id IS NOT NULL
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
             JOIN app_matches m ON m.id = r.match_id
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
    COALESCE(mp.minutes, 0) AS minutes,
    COALESCE(ev.goals, 0) AS goals,
    COALESCE(asst.assists, 0) AS assists,
    COALESCE(ev.yellow_cards, 0) AS yellow_cards,
    COALESCE(ev.red_cards, 0) AS red_cards,
    rt.avg_rating,
    COALESCE(ev.blue_cards, 0) AS blue_cards,
    COALESCE(ev.disciplinary_cards, 0) AS disciplinary_cards
   FROM app_roster ar
     JOIN players p ON p.id = ar.player_id
     LEFT JOIN mp ON mp.season_id = ar.season_id AND mp.player_id = p.id
     LEFT JOIN ev ON ev.season_id = ar.season_id AND ev.player_id = p.id
     LEFT JOIN asst ON asst.season_id = ar.season_id AND asst.player_id = p.id
     LEFT JOIN rt ON rt.season_id = ar.season_id AND rt.player_id = p.id;;
