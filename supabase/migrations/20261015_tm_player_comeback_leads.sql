-- Add go-ahead goals following a verified earlier deficit in the same fixture.
CREATE OR REPLACE VIEW public.app_player_comeback_leads WITH (security_invoker=true) AS
 WITH score_states AS (
         SELECT app_goal_context.season_id,
            app_goal_context.match_id,
            app_goal_context.event_id,
            app_goal_context.player_id,
            app_goal_context.scoring_side,
            app_goal_context.elapsed,
            app_goal_context.before_gf,
            app_goal_context.before_ga,
            app_goal_context.after_gf,
            app_goal_context.after_ga,
            app_goal_context.verified,
            min(app_goal_context.before_gf - app_goal_context.before_ga) OVER (PARTITION BY app_goal_context.match_id ORDER BY app_goal_context.elapsed, app_goal_context.event_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lowest_prior_margin
           FROM app_goal_context
        )
 SELECT season_id,
    player_id,
    count(*)::integer AS comeback_go_ahead_goals
   FROM score_states
  WHERE verified AND player_id IS NOT NULL AND scoring_side = 'team'::text AND before_gf = before_ga AND after_gf > after_ga AND lowest_prior_margin < 0
  GROUP BY season_id, player_id;
GRANT SELECT ON public.app_player_comeback_leads TO anon,authenticated;
NOTIFY pgrst,'reload schema';
