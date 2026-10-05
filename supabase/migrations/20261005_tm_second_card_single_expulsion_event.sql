create or replace function private.tm_app_convert_second_card_to_red()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_previous public.app_match_events%rowtype;
  v_original_type text;
begin
  if new.event_type not in ('yellow_card','blue_card')
     or new.team_side<>'team'
     or new.player_id is null
     or new.validation_status not in ('official','community_confirmed') then
    return new;
  end if;

  select e.* into v_previous
  from public.app_match_events e
  where e.match_id=new.match_id
    and e.player_id=new.player_id
    and e.team_side='team'
    and e.event_type in ('yellow_card','blue_card')
    and e.validation_status in ('official','community_confirmed')
    and (tg_op='INSERT' or e.id<>new.id)
  order by e.created_at,e.id
  limit 1;

  if not found then return new; end if;

  if exists(
    select 1 from public.app_match_events r
    where r.match_id=new.match_id
      and r.player_id=new.player_id
      and r.team_side='team'
      and r.event_type='red_card'
      and r.validation_status<>'rejected'
      and (tg_op='INSERT' or r.id<>new.id)
  ) then
    return new;
  end if;

  v_original_type:=new.event_type;
  new.event_type:='red_card';
  new.payload:=coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
    'automated',true,
    'card_type','second_card',
    'accumulated_cards',jsonb_build_array(v_previous.event_type,v_original_type),
    'previous_card_id',v_previous.id,
    'second_card_original_type',v_original_type,
    'count_score',false,
    'counted_in_score',false,
    'score_applied',false
  );

  return new;
end
$$;

drop trigger if exists trg_tm_app_auto_expulsion_on_second_card on public.app_match_events;
drop trigger if exists trg_tm_app_convert_second_card_to_red on public.app_match_events;

create trigger trg_tm_app_convert_second_card_to_red
before insert or update of event_type,validation_status,player_id,team_side
on public.app_match_events
for each row execute function private.tm_app_convert_second_card_to_red();

with removed as (
  delete from public.app_match_events r
  where r.event_type='red_card'
    and r.payload->>'card_type'='second_card'
    and r.payload->>'source_card_id' is not null
  returning r.payload,r.source_event_key
)
update public.app_match_events e
set event_type='red_card',
    payload=coalesce(e.payload,'{}'::jsonb) || jsonb_build_object(
      'automated',true,
      'card_type','second_card',
      'accumulated_cards',removed.payload->'accumulated_cards',
      'previous_card_id',null,
      'second_card_original_type',e.event_type,
      'count_score',false,
      'counted_in_score',false,
      'score_applied',false
    ),
    source_event_key=coalesce(e.source_event_key,removed.source_event_key)
from removed
where e.id=(removed.payload->>'source_card_id')::uuid;

notify pgrst, 'reload schema';
