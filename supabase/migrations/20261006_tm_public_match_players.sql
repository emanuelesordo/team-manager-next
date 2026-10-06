create or replace function public.tm_app_public_match_players(p_match_id uuid)
returns table(
 id uuid,
 match_id uuid,
 player_id uuid,
 selection_status text,
 started boolean,
 minutes_played smallint,
 shirt_number smallint,
 tactical_slot smallint,
 is_captain boolean,
 unused_sub_reason text
)
language sql
stable
security definer
set search_path=''
as $$
 select mp.id,mp.match_id,mp.player_id,mp.selection_status,mp.started,mp.minutes_played,
        mp.shirt_number,mp.tactical_slot,mp.is_captain,mp.unused_sub_reason
 from public.app_match_players mp
 join public.app_matches m on m.id=mp.match_id
 where mp.match_id=p_match_id
   and not m.is_test
$$;

revoke all on function public.tm_app_public_match_players(uuid) from public;
grant execute on function public.tm_app_public_match_players(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
