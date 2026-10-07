-- Each linked fixture is checked once per Europe/Rome calendar day after 07:00.
-- Three requests per minute; all writes are staging-only and atomic.
create table public.app_match_source_checks (
 fixture_id uuid primary key references public.app_competition_fixtures(id) on delete cascade,
 source_url text,
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 check_status text not null default 'pending' check (check_status in ('pending','checking','ok','error')),
 last_error text,
 last_changed_at timestamptz
);
alter table public.app_match_source_checks enable row level security;
revoke all on public.app_match_source_checks from public,anon,authenticated;
grant select on public.app_match_source_checks to authenticated;
grant select,insert,update on public.app_match_source_checks to service_role;
create policy app_match_source_checks_staff_select on public.app_match_source_checks
 for select to authenticated using ((select private.is_staff()));

create table private.csi_sync_settings (
 singleton boolean primary key default true check (singleton),
 token text not null default encode(extensions.gen_random_bytes(32),'hex'),
 enabled boolean not null default false
);
revoke all on private.csi_sync_settings from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.csi_sync_settings to service_role;
insert into private.csi_sync_settings(singleton) values(true);

create function public.tm_csi_scheduler_authorized(p_token text) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from private.csi_sync_settings where singleton and enabled and token=p_token);
$$;
revoke all on function public.tm_csi_scheduler_authorized(text) from public,anon,authenticated;
grant execute on function public.tm_csi_scheduler_authorized(text) to service_role;

create function public.tm_csi_stage_snapshot(p_fixture_id uuid,p_source_url text,p_payload jsonb,p_created_by uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.app_competition_fixtures; latest public.app_match_source_snapshots; sid uuid; mid uuid;
 h text; ev jsonb; ordinal bigint; changed boolean;
begin
 -- Lock the fixture to serialize manual/scheduled imports and avoid duplicate proposals.
 select * into strict f from public.app_competition_fixtures where id=p_fixture_id for update;
 if coalesce(f.source_url,'manual-json')<>p_source_url then raise exception 'Link CSI modificato durante il controllo: riprova'; end if;
 if jsonb_typeof(p_payload->'events')<>'array' then raise exception 'Eventi CSI non validi'; end if;
 select * into latest from public.app_match_source_snapshots where fixture_id=f.id and source='csi' order by fetched_at desc,id desc limit 1;
 changed:=latest.id is null or latest.raw_payload is distinct from p_payload;
 -- Include the parent revision in the fingerprint: preserve the existing unique constraint
 -- while recording real A -> B -> A transitions as a new proposal.
 h:=encode(extensions.digest(p_payload::text||coalesce(latest.id::text,''),'sha256'),'hex');
 if changed then
  select id into mid from public.app_matches where fixture_id=f.id;
  update public.app_match_source_snapshots set review_status='superseded' where fixture_id=f.id and source='csi' and review_status in ('pending','reviewing');
  insert into public.app_match_source_snapshots(fixture_id,match_id,source,source_url,source_match_code,payload_hash,review_status,home_score,away_score,raw_payload,created_by,fetched_at)
  values(f.id,mid,'csi',p_source_url,p_payload->>'code',h,'pending',(p_payload#>>'{home,score}')::smallint,(p_payload#>>'{away,score}')::smallint,p_payload,p_created_by,clock_timestamp()) returning id into sid;
  for ev,ordinal in select value, ordinality-1 from jsonb_array_elements(p_payload->'events') with ordinality loop
   insert into public.app_match_source_events(snapshot_id,event_ordinal,period,minute,stoppage_minute,source_team_side,event_type,player_name,shirt_number,player_out_name,player_out_number,player_in_name,player_in_number,score_home,score_away,raw_payload)
   values(sid,ordinal,(ev->>'period')::smallint,(ev->>'minute')::smallint,(ev->>'stoppage_minute')::smallint,ev->>'team',ev->>'type',ev#>>'{player,name}',(ev#>>'{player,number}')::smallint,ev#>>'{player_out,name}',(ev#>>'{player_out,number}')::smallint,ev#>>'{player_in,name}',(ev#>>'{player_in,number}')::smallint,(ev#>>'{score,home}')::smallint,(ev#>>'{score,away}')::smallint,ev);
  end loop;
 else sid:=latest.id;
 end if;
 insert into public.app_match_source_checks(fixture_id,source_url,last_attempt_at,last_success_at,check_status,last_error,last_changed_at)
 values(f.id,p_source_url,now(),now(),'ok',null,case when changed then now() else null end)
 on conflict(fixture_id) do update set source_url=excluded.source_url,last_attempt_at=now(),last_success_at=now(),check_status='ok',last_error=null,
 last_changed_at=case when changed then now() else public.app_match_source_checks.last_changed_at end;
 return jsonb_build_object('ok',true,'changed',changed,'snapshot_id',sid,'events',jsonb_array_length(p_payload->'events'));
end $$;
revoke all on function public.tm_csi_stage_snapshot(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.tm_csi_stage_snapshot(uuid,text,jsonb,uuid) to service_role;

create function private.dispatch_csi_checks(p_force boolean default false) returns integer
language plpgsql security invoker set search_path='' as $$
declare f record; secret text; project_url text; dispatched integer:=0; local_now timestamp:=now() at time zone 'Europe/Rome';
begin
 if not pg_try_advisory_xact_lock(hashtext('tm-csi-daily-dispatch')) then return 0; end if;
 select token into secret from private.csi_sync_settings where singleton and enabled;
 if secret is null or (not p_force and local_now::time<time '07:00') then return 0; end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='team_manager_project_url';
 if project_url is null then raise exception 'URL progetto mancante in Vault'; end if;
 update public.app_match_source_checks set check_status='error',last_error='Controllo CSI non completato: riprova con Controlla ora CSI'
 where check_status='checking' and last_attempt_at<now()-interval '3 minutes';
 for f in
  select fixture.id,fixture.source_url from public.app_competition_fixtures fixture
  left join public.app_match_source_checks checks on checks.fixture_id=fixture.id
  where nullif(trim(fixture.source_url),'') is not null and not coalesce(fixture.is_test,false)
   and (checks.last_attempt_at is null or (checks.last_attempt_at at time zone 'Europe/Rome')::date<local_now::date or checks.source_url is distinct from fixture.source_url)
  order by fixture.kickoff_at,fixture.id limit 3
 loop
  insert into public.app_match_source_checks(fixture_id,source_url,last_attempt_at,check_status,last_error)
  values(f.id,f.source_url,now(),'checking',null)
  on conflict(fixture_id) do update set source_url=excluded.source_url,last_attempt_at=now(),check_status='checking',last_error=null;
  perform net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/csi-match-parser',headers:=jsonb_build_object('Content-Type','application/json','x-csi-sync',secret),body:=jsonb_build_object('fixture_id',f.id),timeout_milliseconds:=60000);
  dispatched:=dispatched+1;
 end loop;
 return dispatched;
end $$;
revoke all on function private.dispatch_csi_checks(boolean) from public,anon,authenticated,service_role;
select cron.schedule('team-manager-csi-daily','* * * * *','select private.dispatch_csi_checks();');
