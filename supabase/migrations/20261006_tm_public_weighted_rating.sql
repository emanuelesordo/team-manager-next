create or replace function public.tm_app_public_weighted_rating(p_match_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
with cfg as (
  select m.id,
         coalesce(m.minutes_per_period_override,c.minutes_per_period,40)::numeric as period_len,
         coalesce(m.periods_override,c.periods,2)::int as periods
  from public.app_matches m
  left join public.app_competitions c on c.id=m.competition_id
  where m.id=p_match_id
),
period_recovery as (
  select coalesce((e.payload->>'period_no')::int,
                  case e.payload->>'period'
                    when 'second_half' then 2 when 'extra' then 3 else 1 end) as pno,
         greatest(0,coalesce(nullif(e.payload->>'recovery_declared','')::numeric,
                             nullif(e.payload->>'recovery_minutes','')::numeric,
                             e.stoppage_minute::numeric,0)) as rec
  from public.app_match_events e
  where e.match_id=p_match_id
    and e.event_type='period_end'
    and e.validation_status<>'rejected'
),
total_cfg as (
  select cfg.*,
         cfg.period_len*cfg.periods + coalesce((select sum(rec) from period_recovery),0) as total_end
  from cfg
),
event_times as (
  select e.*,
         case
           when e.minute is null then null
           else (
             case
               when e.payload->>'period'='second_half'
                    and coalesce(e.payload->>'minute_relative','true')<>'false'
                    and coalesce(e.payload->>'entered_from','')<>'tm_app_live'
                 then e.minute + tc.period_len
               else e.minute::numeric
             end
             + coalesce((
                 select sum(pr.rec) from period_recovery pr
                 where pr.pno < coalesce((e.payload->>'period_no')::int,
                    case e.payload->>'period'
                      when 'second_half' then 2 when 'extra' then 3 else 1 end)
               ),0)
             + greatest(0,coalesce(e.stoppage_minute,0))
           )
         end as t
  from public.app_match_events e
  cross join total_cfg tc
  where e.match_id=p_match_id and e.validation_status<>'rejected'
),
transitions as (
  select mp.player_id,0::numeric as t,1 as on_state,0 as ord
  from public.app_match_players mp
  where mp.match_id=p_match_id and coalesce(mp.started,false)
  union all
  select e.player_id,e.t,0,1
  from event_times e
  where e.t is not null and e.team_side='team'
    and e.player_id is not null
    and e.event_type in ('substitution','red_card','blue_card')
  union all
  select e.secondary_player_id,e.t,1,2
  from event_times e
  where e.t is not null and e.team_side='team'
    and e.secondary_player_id is not null
    and e.event_type='substitution'
  union all
  select e.player_id,e.t,1,2
  from event_times e
  where e.t is not null and e.team_side='team'
    and e.player_id is not null
    and e.event_type in ('blue_return','temporary_return','return_from_blue')
),
players_touched as (
  select distinct player_id from transitions where player_id is not null
),
all_transitions as (
  select * from transitions
  union all
  select p.player_id,tc.total_end,0,9 from players_touched p cross join total_cfg tc
),
spans as (
  select player_id,t,on_state,
         lead(t) over(partition by player_id order by t,ord) as next_t
  from all_transitions
),
minutes as (
  select player_id,
         sum(case when on_state=1 and next_t is not null then greatest(0,next_t-t) else 0 end) as mins
  from spans
  group by player_id
),
votes as (
  select r.player_id,avg(r.rating)::numeric as avg_rating
  from public.app_match_ratings r
  where r.match_id=p_match_id and r.rating between 1 and 10
  group by r.player_id
)
select case when sum(m.mins)>0
       then round(sum(v.avg_rating*m.mins)/sum(m.mins),2)
       else null end
from minutes m
join votes v on v.player_id=m.player_id;
$$;

revoke all on function public.tm_app_public_weighted_rating(uuid) from public;
grant execute on function public.tm_app_public_weighted_rating(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
