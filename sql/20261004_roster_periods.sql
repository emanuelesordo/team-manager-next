-- team-manager-next | Storico appartenenza rosa (stagioni app_*)
-- La tabella legacy player_contracts punta a seasons, quindi non viene modificata.
-- Eseguire una sola volta dopo le migrazioni di app_seasons e app_roster.
CREATE TABLE IF NOT EXISTS public.app_roster_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.app_seasons(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_roster_periods_range CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS app_roster_periods_lookup ON public.app_roster_periods (season_id, player_id, start_date, end_date);
ALTER TABLE public.app_roster_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_roster_periods_staff_select ON public.app_roster_periods;
CREATE POLICY app_roster_periods_staff_select ON public.app_roster_periods
 FOR SELECT TO authenticated USING ((SELECT private.is_staff()));
GRANT SELECT ON public.app_roster_periods TO authenticated;

-- Migrazione dello stato iniziale: i tesserati storici sono presenti
-- dall'inizio stagione; le anagrafiche inserite dal 04/10/2026 sono
-- valide soltanto dalla data di inserimento (rettificabile nel gestionale).
INSERT INTO public.app_roster_periods (season_id,player_id,start_date,end_date)
SELECT r.season_id,r.player_id,
  CASE WHEN p.created_at::date >= DATE '2026-10-04'
       THEN greatest(s.start_date,least(s.end_date,p.created_at::date))
       ELSE s.start_date END,
  s.end_date
FROM public.app_roster r
JOIN public.app_seasons s ON s.id=r.season_id
JOIN public.players p ON p.id=r.player_id
WHERE NOT EXISTS (SELECT 1 FROM public.app_roster_periods rp
 WHERE rp.season_id=r.season_id AND rp.player_id=r.player_id);

CREATE OR REPLACE FUNCTION public.tm_app_guard_callup_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_date date;
begin
 select (m.kickoff_at at time zone 'Europe/Rome')::date into v_date from public.app_matches m where m.id=new.match_id;
 if v_date is null then return new;end if;
 if not exists(select 1 from public.app_roster_periods rp join public.app_matches m on m.season_id=rp.season_id where m.id=new.match_id and rp.player_id=new.player_id and v_date between rp.start_date and rp.end_date)
 then raise exception 'Giocatore non in rosa alla data della partita';end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tm_app_save_callups(p_match_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.app_matches%rowtype; item jsonb; pid uuid; st text; why text; affected integer:=0;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Accesso non autorizzato'; end if;
 select * into m from public.app_matches where id=p_match_id for update;
 if not found then raise exception 'Partita inesistente'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>100 then raise exception 'Convocazioni non valide'; end if;
 if (select count(*) from jsonb_array_elements(p_rows)) <>
    (select count(distinct x->>'player_id') from jsonb_array_elements(p_rows) x) then raise exception 'Giocatori duplicati'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  pid:=(item->>'player_id')::uuid;
  st:=item->>'selection_status';
  why:=nullif(item->>'unavailability_reason','');
  if st not in ('available','absent') then raise exception 'Stato convocazione non valido'; end if;
  if st='absent' then
   if why is null then why:='technical_choice'; end if;
   if why not in ('injury','suspension','personal','illness','technical_choice') then raise exception 'Motivo indisponibilità non valido'; end if;
  else why:=null; end if;
  if not exists(select 1 from public.app_roster ro join public.players p on p.id=ro.player_id join public.app_seasons s on s.id=ro.season_id where ro.player_id=pid and ro.season_id=m.season_id and (ro.active is distinct from false OR exists(select 1 from public.app_roster_periods rp where rp.season_id=m.season_id and rp.player_id=pid and (m.kickoff_at at time zone 'Europe/Rome')::date between rp.start_date and rp.end_date)) and p.team_id=s.team_id) then
   raise exception 'Giocatore non in rosa: %',pid;
  end if;
  if st='absent' and exists(select 1 from public.app_match_players mp where mp.match_id=p_match_id and mp.player_id=pid and (mp.started or mp.selection_status in ('starter','bench') or coalesce(mp.minutes_played,0)>0)) then
   raise exception 'Giocatore già schierato: %',pid;
  end if;
  if st='absent' and exists(select 1 from public.app_match_events ev where ev.match_id=p_match_id and (ev.player_id=pid or ev.secondary_player_id=pid)) then
   raise exception 'Giocatore con eventi registrati: %',pid;
  end if;
  insert into public.app_match_players(match_id,player_id,selection_status,started,unavailability_reason)
  values(p_match_id,pid,st,false,why)
  on conflict(match_id,player_id) do update
   set selection_status=case when public.app_match_players.selection_status in ('starter','bench') or public.app_match_players.started or coalesce(public.app_match_players.minutes_played,0)>0 then public.app_match_players.selection_status else excluded.selection_status end,
       unavailability_reason=case when public.app_match_players.selection_status in ('starter','bench') or public.app_match_players.started or coalesce(public.app_match_players.minutes_played,0)>0 then public.app_match_players.unavailability_reason else excluded.unavailability_reason end;
  affected:=affected+1;
 end loop;
 return affected;
end $function$
;

CREATE OR REPLACE FUNCTION public.tm_app_set_player_period(p_season_id uuid, p_player_id uuid, p_start_date date, p_end_date date DEFAULT NULL::date, p_period_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_season public.app_seasons%rowtype;v_id uuid;v_end date;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Accesso riservato allo staff';end if;
 select * into v_season from public.app_seasons where id=p_season_id;
 if not found then raise exception 'Stagione inesistente';end if;
 if not exists(select 1 from public.app_roster r join public.players p on p.id=r.player_id where r.season_id=p_season_id and r.player_id=p_player_id and p.team_id=v_season.team_id)
 then raise exception 'Giocatore fuori rosa';end if;
 v_end:=coalesce(p_end_date,v_season.end_date);
 if p_start_date is null or p_start_date<v_season.start_date or v_end>v_season.end_date or p_start_date>v_end
 then raise exception 'Date non valide per la stagione';end if;
 if exists(select 1 from public.app_roster_periods rp where rp.season_id=p_season_id and rp.player_id=p_player_id and (p_period_id is null or rp.id<>p_period_id) and rp.start_date<=v_end and p_start_date<=rp.end_date)
 then raise exception 'Il periodo si sovrappone a un periodo già registrato';end if;
 if p_period_id is not null then
  update public.app_roster_periods set start_date=p_start_date,end_date=v_end where id=p_period_id and season_id=p_season_id and player_id=p_player_id returning id into v_id;
  if v_id is null then raise exception 'Periodo non trovato';end if;
 else
  insert into public.app_roster_periods(season_id,player_id,start_date,end_date)
  values(p_season_id,p_player_id,p_start_date,v_end) returning id into v_id;
 end if;
 return v_id;
end $function$
;

DROP TRIGGER IF EXISTS tm_app_guard_callup_period_trigger ON public.app_match_players;
CREATE TRIGGER tm_app_guard_callup_period_trigger
 BEFORE INSERT OR UPDATE OF player_id,match_id ON public.app_match_players
 FOR EACH ROW EXECUTE FUNCTION public.tm_app_guard_callup_period();
REVOKE ALL ON FUNCTION public.tm_app_set_player_period(uuid,uuid,date,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_app_set_player_period(uuid,uuid,date,date,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
