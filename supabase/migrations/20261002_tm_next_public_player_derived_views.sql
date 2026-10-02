CREATE OR REPLACE VIEW public.tm_player_habitual_shirts AS
WITH counts AS (
 SELECT mp.player_id,mp.shirt_number,count(*)::integer AS occurrences,max(m.kickoff_at) AS last_used
 FROM public.app_match_players mp JOIN public.app_matches m ON m.id=mp.match_id
 WHERE m.status='finished' AND mp.shirt_number BETWEEN 1 AND 99
 GROUP BY mp.player_id,mp.shirt_number
)
SELECT DISTINCT ON (player_id) player_id,shirt_number,occurrences,last_used
FROM counts ORDER BY player_id,occurrences DESC,last_used DESC NULLS LAST,shirt_number DESC;

CREATE OR REPLACE VIEW public.tm_player_recent_votes AS
SELECT m.season_id,m.id AS match_id,m.kickoff_at,r.player_id,o.name AS opponent,
 ROUND(avg(r.rating),2)::numeric AS avg_rating,
 count(r.rating)::integer AS votes,
 count(*) FILTER(WHERE r.rating IS NULL)::integer AS sv
FROM public.app_match_ratings r
JOIN public.app_matches m ON m.id=r.match_id AND m.status='finished'
LEFT JOIN public.app_opponents o ON o.id=m.opponent_id
GROUP BY m.season_id,m.id,m.kickoff_at,r.player_id,o.name;

REVOKE ALL ON TABLE public.tm_player_habitual_shirts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.tm_player_recent_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.tm_player_habitual_shirts TO anon,authenticated;
GRANT SELECT ON TABLE public.tm_player_recent_votes TO anon,authenticated;