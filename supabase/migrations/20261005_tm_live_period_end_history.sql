create or replace function public.tm_app_end_period(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  m public.app_matches%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_elapsed integer;
  v_len integer;
  v_count integer;
  v_no integer;
  v_regulation integer;
  v_recovery_actual integer;
  v_recovery_declared integer;
  v_next_period text;
  v_period_home integer:=0;
  v_period_away integer:=0;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Accesso non autorizzato'; end if;
  select * into m from public.app_matches where id=p_match_id for update;
  if not found or m.status<>'live' then raise exception 'La partita non è in corso'; end if;
  if m.is_test and m.test_owner_id is distinct from auth.uid() then raise exception 'Match di test non accessibile'; end if;
  if not coalesce(m.live_clock_running,false) then raise exception 'Il cronometro del periodo è già fermo'; end if;

  v_len:=private.tm_app_period_length(m.id);
  v_count:=private.tm_app_period_count(m.id);
  v_no:=greatest(1,coalesce(m.live_period_no,1));
  v_elapsed:=coalesce(m.live_clock_seconds,0)+case when m.live_clock_anchor is not null
    then greatest(0,floor(extract(epoch from(v_now-m.live_clock_anchor)))::integer) else 0 end;
  v_regulation:=v_no*v_len*60;
  v_recovery_actual:=greatest(0,ceil(greatest(0,v_elapsed-v_regulation)/60.0)::integer);
  v_recovery_declared:=case when m.live_recovery_period_no=v_no then coalesce(m.live_recovery_minutes,0) else 0 end;

  select count(*) filter(where score_side='home'),count(*) filter(where score_side='away')
  into v_period_home,v_period_away
  from (
    select case
      when e.event_type='own_goal' then case
        when (m.home_away='home' and e.team_side='team') or (m.home_away='away' and e.team_side='opponent') then 'away' else 'home' end
      when (m.home_away='home' and e.team_side='team') or (m.home_away='away' and e.team_side='opponent') then 'home'
      else 'away' end as score_side
    from public.app_match_events e
    where e.match_id=m.id and e.validation_status in ('official','community_confirmed')
      and e.event_type in ('goal','own_goal','penalty_scored')
      and coalesce((e.payload->>'count_score')::boolean,true)
      and coalesce((e.payload->>'period_no')::integer,case when e.payload->>'period'='second_half' then 2 else 1 end)=v_no
  ) goals;

  if not exists (
    select 1 from public.app_match_events e
    where e.match_id=m.id and e.event_type='period_end'
      and coalesce((e.payload->>'period_no')::integer,0)=v_no and e.validation_status<>'rejected'
  ) then
    insert into public.app_match_events(match_id,fixture_id,event_type,minute,stoppage_minute,payload,
      proposed_by,validation_status,officialized_by,officialized_at,team_side,source,captured_at)
    values(m.id,m.fixture_id,'period_end',v_no*v_len,case when v_recovery_actual>0 then v_recovery_actual else null end,
      jsonb_build_object('entered_from','period_control','period_no',v_no,'period',m.live_period,
        'recovery_minutes',greatest(v_recovery_declared,v_recovery_actual),'recovery_declared',v_recovery_declared,
        'recovery_actual',v_recovery_actual,'score_home',coalesce(m.home_score,0),'score_away',coalesce(m.away_score,0),
        'period_score_home',v_period_home,'period_score_away',v_period_away,
        'label',case when v_no=1 then 'HT' else 'FINE '||v_no||'° TEMPO' end,'count_score',false),
      auth.uid(),'official',auth.uid(),v_now,'team','period_control',v_now);
  end if;

  insert into public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by)
  values(m.id,m.live_period,v_no,'period_end',v_now,false,'period_end_action',auth.uid());

  v_next_period:=case when v_no<v_count then 'halftime' else m.live_period end;
  update public.app_matches set live_period=v_next_period,live_clock_seconds=v_elapsed,
    live_clock_running=false,live_clock_anchor=null where id=m.id;

  return jsonb_build_object('match_id',m.id,'period_no',v_no,'clock_seconds',v_elapsed,
    'recovery_minutes',greatest(v_recovery_declared,v_recovery_actual),
    'score_home',coalesce(m.home_score,0),'score_away',coalesce(m.away_score,0),
    'period_score_home',v_period_home,'period_score_away',v_period_away);
end
$$;

revoke all on function public.tm_app_end_period(uuid) from public;
grant execute on function public.tm_app_end_period(uuid) to authenticated;
notify pgrst, 'reload schema';
