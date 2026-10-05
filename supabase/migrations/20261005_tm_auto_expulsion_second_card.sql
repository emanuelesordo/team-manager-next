create or replace function private.tm_app_auto_expulsion_on_second_card()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cards text[];
  v_second public.app_match_events%rowtype;
begin
  if new.event_type not in ('yellow_card','blue_card')
     or new.team_side<>'team'
     or new.player_id is null
     or new.validation_status not in ('official','community_confirmed') then
    return new;
  end if;

  select array_agg(x.event_type order by x.created_at,x.id)
  into v_cards
  from (
    select e.event_type,e.created_at,e.id
    from public.app_match_events e
    where e.match_id=new.match_id
      and e.player_id=new.player_id
      and e.team_side='team'
      and e.event_type in ('yellow_card','blue_card')
      and e.validation_status in ('official','community_confirmed')
    order by e.created_at,e.id
    limit 2
  ) x;

  if coalesce(array_length(v_cards,1),0)<2 then return new; end if;

  if exists(
    select 1 from public.app_match_events r
    where r.match_id=new.match_id
      and r.player_id=new.player_id
      and r.team_side='team'
      and r.event_type='red_card'
      and r.validation_status<>'rejected'
  ) then return new; end if;

  select e.* into v_second
  from public.app_match_events e
  where e.match_id=new.match_id
    and e.player_id=new.player_id
    and e.team_side='team'
    and e.event_type in ('yellow_card','blue_card')
    and e.validation_status in ('official','community_confirmed')
  order by e.created_at,e.id
  offset 1 limit 1;

  insert into public.app_match_events(
    match_id,fixture_id,event_type,minute,stoppage_minute,player_id,
    payload,proposed_by,validation_status,officialized_by,officialized_at,
    team_side,source,source_event_key,captured_at,expected_at,
    timing_delta_seconds,timing_consistent
  )
  values(
    v_second.match_id,v_second.fixture_id,'red_card',v_second.minute,v_second.stoppage_minute,v_second.player_id,
    coalesce(v_second.payload,'{}'::jsonb) || jsonb_build_object(
      'automated',true,'card_type','second_card',
      'accumulated_cards',to_jsonb(v_cards),'source_card_id',v_second.id,
      'count_score',false,'counted_in_score',false,'score_applied',false
    ),
    v_second.proposed_by,'official',
    coalesce(v_second.officialized_by,v_second.proposed_by),clock_timestamp(),
    'team','tm_app_live',
    'auto-red-second-card-'||v_second.match_id::text||'-'||v_second.player_id::text,
    coalesce(v_second.captured_at,clock_timestamp()),v_second.expected_at,
    v_second.timing_delta_seconds,v_second.timing_consistent
  )
  on conflict (match_id,source_event_key) where source_event_key is not null do nothing;

  return new;
end
$$;

drop trigger if exists trg_tm_app_auto_expulsion_on_second_card on public.app_match_events;
create trigger trg_tm_app_auto_expulsion_on_second_card
after insert or update of event_type,validation_status,player_id,team_side
on public.app_match_events
for each row execute function private.tm_app_auto_expulsion_on_second_card();

with ranked as (
  select e.*,
         row_number() over(partition by e.match_id,e.player_id order by e.created_at,e.id) rn,
         array_agg(e.event_type) over(
           partition by e.match_id,e.player_id
           order by e.created_at,e.id
           rows between unbounded preceding and current row
         ) history
  from public.app_match_events e
  join public.app_matches m on m.id=e.match_id
  where m.status='live'
    and e.team_side='team'
    and e.player_id is not null
    and e.event_type in ('yellow_card','blue_card')
    and e.validation_status in ('official','community_confirmed')
),
second_cards as (
  select * from ranked where rn=2
)
insert into public.app_match_events(
  match_id,fixture_id,event_type,minute,stoppage_minute,player_id,
  payload,proposed_by,validation_status,officialized_by,officialized_at,
  team_side,source,source_event_key,captured_at,expected_at,
  timing_delta_seconds,timing_consistent
)
select
  s.match_id,s.fixture_id,'red_card',s.minute,s.stoppage_minute,s.player_id,
  coalesce(s.payload,'{}'::jsonb) || jsonb_build_object(
    'automated',true,'card_type','second_card',
    'accumulated_cards',to_jsonb(s.history),'source_card_id',s.id,
    'count_score',false,'counted_in_score',false,'score_applied',false
  ),
  s.proposed_by,'official',coalesce(s.officialized_by,s.proposed_by),clock_timestamp(),
  'team','tm_app_live',
  'auto-red-second-card-'||s.match_id::text||'-'||s.player_id::text,
  coalesce(s.captured_at,clock_timestamp()),s.expected_at,
  s.timing_delta_seconds,s.timing_consistent
from second_cards s
where not exists(
  select 1 from public.app_match_events r
  where r.match_id=s.match_id
    and r.player_id=s.player_id
    and r.team_side='team'
    and r.event_type='red_card'
    and r.validation_status<>'rejected'
)
on conflict (match_id,source_event_key) where source_event_key is not null do nothing;

notify pgrst, 'reload schema';
