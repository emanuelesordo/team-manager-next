-- Read-only audit for the authoritative app_player_season_stats results.
-- Run after supabase/migrations/20261013_tm_shared_verified_player_facts.sql.
-- Zero mismatches and the full team-minute invariant are expected.

-- Reconcile the public view against the private source.
SELECT s.season_id,
 count(*) AS players,
 count(*) FILTER (WHERE s.minutes_coverage='complete') AS verified_players,
 count(*) FILTER (WHERE s.minutes_coverage='unavailable') AS unavailable_players,
 count(*) FILTER (WHERE s.minutes_coverage='complete' AND
    (s.minutes IS DISTINCT FROM p.minutes OR s.subentries IS DISTINCT FROM p.subentries)) AS final_value_mismatches,
 count(*) FILTER (WHERE p.appearances IS NOT NULL AND s.appearances<>p.appearances) AS appearance_mismatches,
 sum(s.minutes) AS total_verified_minutes,
 sum(s.subentries) AS confirmed_subentries
FROM public.app_player_season_stats s
LEFT JOIN private.tm_player_season_participation p
 ON p.season_id=s.season_id AND p.player_id=s.player_id
GROUP BY s.season_id
ORDER BY s.season_id;

-- Confirm minutes on the field; 11 players × effective match duration if no dismissals.
SELECT m.id,m.kickoff_at::date AS played,
 count(*) FILTER (WHERE p.appeared) AS appearances,
 count(*) FILTER (WHERE p.subentered) AS subentries,
 count(*) FILTER (WHERE p.appeared AND NOT p.valid) AS invalid_appearances,
 sum(p.minutes) AS total_player_minutes,
 max(p.duration)*11 AS eleven_player_reference
FROM private.tm_player_match_participation p
JOIN public.app_matches m ON m.id=p.match_id
GROUP BY m.id,m.kickoff_at
ORDER BY m.kickoff_at;

-- Compare the public weighted-rating RPC against its canonical minute inputs.
SELECT m.id,m.kickoff_at::date AS played,
 public.tm_app_public_weighted_rating(m.id) AS rated_by_rpc,
 (
  SELECT round(sum(v.mean_rating*p.minutes)/nullif(sum(p.minutes),0),2)
  FROM private.tm_player_match_participation p
  JOIN (
   SELECT match_id,player_id,avg(rating)::numeric AS mean_rating
   FROM public.app_match_ratings WHERE rating BETWEEN 1 AND 10
   GROUP BY match_id,player_id
  ) v ON v.match_id=p.match_id AND v.player_id=p.player_id
  WHERE p.match_id=m.id AND p.appeared AND p.valid
 ) AS recalculated_from_canonical_minutes
FROM public.app_matches m
WHERE m.status='finished' AND NOT m.is_test
ORDER BY m.kickoff_at;
