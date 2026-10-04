-- Conferma ufficiale distinta dall'autosalvataggio, divisa partita e motivi panchina.
alter table public.app_matches add column if not exists lineup_confirmed_at timestamptz, add column if not exists lineup_confirmed_by uuid, add column if not exists match_kit_key text;
-- unused_sub_reason esiste gia' su app_match_players.
create or replace function public.tm_app_confirm_lineup(p_match_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare n integer; slots integer; stamp timestamptz;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Accesso non autorizzato'; end if;
 perform 1 from public.app_matches where id=p_match_id for update;
 if not found then raise exception 'Partita non trovata'; end if;
 select count(*),count(distinct tactical_slot) into n,slots from public.app_match_players where match_id=p_match_id and selection_status='starter' and tactical_slot between 1 and 11;
 if n<>11 or slots<>11 then raise exception 'Servono 11 titolari, ciascuno in una posizione differente'; end if;
 update public.app_matches set lineup_confirmed_at=now(),lineup_confirmed_by=auth.uid() where id=p_match_id returning lineup_confirmed_at into stamp;
 return stamp;
end $$;
create or replace function public.tm_app_match_details(p_match_id uuid,p_kit_key text default null,p_reason_player uuid default null,p_reason text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Accesso non autorizzato'; end if;
 perform 1 from public.app_matches where id=p_match_id for update;
 if not found then raise exception 'Partita non trovata'; end if;
 if p_reason_player is not null then
  if p_reason is not null and p_reason not in ('illness','injury','technical_choice') then raise exception 'Motivo non valido'; end if;
  update public.app_match_players set unused_sub_reason=p_reason where match_id=p_match_id and player_id=p_reason_player and selection_status='bench' and coalesce(minutes_played,0)=0;
  if not found then raise exception 'Il giocatore non risulta panchinaro senza ingresso'; end if;
 else
  if length(coalesce(p_kit_key,''))>60 then raise exception 'Divisa non valida'; end if;
  update public.app_matches set match_kit_key=p_kit_key where id=p_match_id;
 end if;
 return true;
end $$;
grant execute on function public.tm_app_confirm_lineup(uuid) to authenticated;
grant execute on function public.tm_app_match_details(uuid,text,uuid,text) to authenticated;
create or replace function public.tm_app_invalidate_lineup_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  update public.app_matches set lineup_confirmed_at=null,lineup_confirmed_by=null where id=old.match_id and lineup_confirmed_at is not null;
  return old;
 end if;
 if tg_op='INSERT' or old.selection_status is distinct from new.selection_status or old.tactical_slot is distinct from new.tactical_slot or old.shirt_number is distinct from new.shirt_number or old.is_captain is distinct from new.is_captain then
  update public.app_matches set lineup_confirmed_at=null,lineup_confirmed_by=null where id=new.match_id and lineup_confirmed_at is not null;
 end if;
 return new;
end $$;
drop trigger if exists tm_lineup_confirmation_player_edit on public.app_match_players;
create trigger tm_lineup_confirmation_player_edit after insert or update or delete on public.app_match_players for each row execute function public.tm_app_invalidate_lineup_confirmation();
create or replace function public.tm_app_invalidate_formation_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.formation is distinct from new.formation then new.lineup_confirmed_at:=null;new.lineup_confirmed_by:=null; end if;
 return new;
end $$;
drop trigger if exists tm_lineup_formation_change on public.app_matches;
create trigger tm_lineup_formation_change before update of formation on public.app_matches for each row execute function public.tm_app_invalidate_formation_change();
