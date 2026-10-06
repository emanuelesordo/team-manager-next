-- Extend historical club form with ranking size and final goal difference.
alter table public.app_club_season_history
  add column if not exists total_positions smallint,
  add column if not exists goal_difference integer;

alter table public.app_club_season_history
  drop constraint if exists app_club_season_history_total_positions_chk,
  add constraint app_club_season_history_total_positions_chk
    check (
      total_positions is null or
      (total_positions >= 2 and total_positions <= 100 and final_position <= total_positions)
    ),
  drop constraint if exists app_club_season_history_goal_difference_chk,
  add constraint app_club_season_history_goal_difference_chk
    check (goal_difference is null or goal_difference between -999 and 999);
