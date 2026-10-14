-- Single season rollup of authoritative player totals and materialized match impact.
CREATE OR REPLACE VIEW public.app_player_calculated_season WITH (security_invoker=true) AS
 SELECT base.season_id,
    base.player_id,
    base.first_name,
    base.last_name,
    base.position_group,
    base.appearances,
    base.starts,
    base.minutes,
    base.goals,
    base.assists,
    base.yellow_cards,
    base.red_cards,
    base.avg_rating,
    base.blue_cards,
    base.disciplinary_cards,
    base.subentries,
    base.minutes_coverage,
    base.match_minutes,
        CASE
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared) = 0 THEN 0::bigint
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared AND cache.score_coverage = 'complete'::text) = count(cache.match_id) FILTER (WHERE cache.appeared) THEN sum(cache.goals_for_on) FILTER (WHERE cache.appeared)
            ELSE NULL::bigint
        END::integer AS goals_for_on,
        CASE
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared) = 0 THEN 0::bigint
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared AND cache.score_coverage = 'complete'::text) = count(cache.match_id) FILTER (WHERE cache.appeared) THEN sum(cache.goals_against_on) FILTER (WHERE cache.appeared)
            ELSE NULL::bigint
        END::integer AS goals_against_on,
        CASE
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared) = 0 THEN 0::bigint
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared AND cache.score_coverage = 'complete'::text) = count(cache.match_id) FILTER (WHERE cache.appeared) THEN sum(cache.plus_minus) FILTER (WHERE cache.appeared)
            ELSE NULL::bigint
        END::integer AS plus_minus_on,
    count(cache.match_id) FILTER (WHERE cache.appeared AND cache.score_coverage = 'complete'::text)::integer AS verified_impact_games,
    count(cache.match_id) FILTER (WHERE cache.appeared)::integer AS cached_appearances,
        CASE
            WHEN count(cache.match_id) FILTER (WHERE cache.appeared) = base.appearances AND count(cache.match_id) FILTER (WHERE cache.appeared AND cache.score_coverage = 'complete'::text) = base.appearances THEN 'complete'::text
            ELSE 'partial'::text
        END AS impact_coverage
   FROM app_player_season_stats base
     LEFT JOIN app_match_player_calculated cache ON cache.player_id = base.player_id AND cache.season_id = base.season_id
  GROUP BY base.season_id, base.player_id, base.first_name, base.last_name, base.position_group, base.appearances, base.starts, base.minutes, base.goals, base.assists, base.yellow_cards, base.red_cards, base.avg_rating, base.blue_cards, base.disciplinary_cards, base.subentries, base.minutes_coverage, base.match_minutes;
GRANT SELECT ON public.app_player_calculated_season TO anon,authenticated;
NOTIFY pgrst,'reload schema';
