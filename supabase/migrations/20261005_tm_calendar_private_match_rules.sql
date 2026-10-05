-- Private test/friendly matches created directly from the calendar.
-- Per-match period duration/count and rolling substitutions override competition defaults.

ALTER TABLE public.app_matches
  ADD COLUMN IF NOT EXISTS periods_override smallint,
  ADD COLUMN IF NOT EXISTS minutes_per_period_override smallint,
  ADD COLUMN IF NOT EXISTS rolling_substitutions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_period_no smallint NOT NULL DEFAULT 0;

ALTER TABLE public.app_matches DROP CONSTRAINT IF EXISTS app_matches_periods_override_check;
ALTER TABLE public.app_matches ADD CONSTRAINT app_matches_periods_override_check
  CHECK (periods_override IS NULL OR periods_override BETWEEN 1 AND 6);
ALTER TABLE public.app_matches DROP CONSTRAINT IF EXISTS app_matches_minutes_override_check;
ALTER TABLE public.app_matches ADD CONSTRAINT app_matches_minutes_override_check
  CHECK (minutes_per_period_override IS NULL OR minutes_per_period_override BETWEEN 1 AND 120);
ALTER TABLE public.app_matches DROP CONSTRAINT IF EXISTS app_matches_live_period_no_check;
ALTER TABLE public.app_matches ADD CONSTRAINT app_matches_live_period_no_check
  CHECK (live_period_no BETWEEN 0 AND 6);

ALTER TABLE public.tm_app_match_time_anchors ADD COLUMN IF NOT EXISTS period_no smallint;
UPDATE public.tm_app_match_time_anchors
SET period_no=CASE period WHEN 'first_half' THEN 1 WHEN 'second_half' THEN 2 WHEN 'extra' THEN 3 ELSE period_no END
WHERE period_no IS NULL;
CREATE INDEX IF NOT EXISTS tm_app_match_time_anchors_period_no_idx
  ON public.tm_app_match_time_anchors(match_id,period_no,anchor_kind,anchor_at);

DROP POLICY IF EXISTS app_matches_staff_insert ON public.app_matches;
DROP POLICY IF EXISTS app_matches_staff_update ON public.app_matches;
DROP POLICY IF EXISTS app_matches_staff_delete ON public.app_matches;
CREATE POLICY app_matches_staff_insert ON public.app_matches FOR INSERT TO authenticated
  WITH CHECK (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));
CREATE POLICY app_matches_staff_update ON public.app_matches FOR UPDATE TO authenticated
  USING (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()))
  WITH CHECK (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));
CREATE POLICY app_matches_staff_delete ON public.app_matches FOR DELETE TO authenticated
  USING (private.is_staff() AND (NOT is_test OR test_owner_id=auth.uid()));

DROP POLICY IF EXISTS app_events_insert ON public.app_match_events;
CREATE POLICY app_events_insert ON public.app_match_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=proposed_by AND private.tm_can_read_match(match_id));

DROP POLICY IF EXISTS app_match_players_staff_insert ON public.app_match_players;
DROP POLICY IF EXISTS app_match_players_staff_update ON public.app_match_players;
DROP POLICY IF EXISTS app_match_players_staff_delete ON public.app_match_players;
CREATE POLICY app_match_players_staff_insert ON public.app_match_players FOR INSERT TO authenticated
  WITH CHECK (private.is_staff() AND private.tm_can_read_match(match_id));
CREATE POLICY app_match_players_staff_update ON public.app_match_players FOR UPDATE TO authenticated
  USING (private.is_staff() AND private.tm_can_read_match(match_id))
  WITH CHECK (private.is_staff() AND private.tm_can_read_match(match_id));
CREATE POLICY app_match_players_staff_delete ON public.app_match_players FOR DELETE TO authenticated
  USING (private.is_staff() AND private.tm_can_read_match(match_id));

CREATE OR REPLACE FUNCTION private.tm_app_best_period_anchor_no(p_match_id uuid, p_period_no integer)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT a.anchor_at
 FROM public.tm_app_match_time_anchors a
 WHERE a.match_id=p_match_id
   AND coalesce(a.period_no,CASE a.period WHEN 'first_half' THEN 1 WHEN 'second_half' THEN 2 WHEN 'extra' THEN 3 END)=p_period_no
   AND a.anchor_kind='period_start'
 ORDER BY a.is_estimated ASC,
          CASE a.source WHEN 'operator_realtime' THEN 0 WHEN 'period_start_action' THEN 1 WHEN 'period_end_derived' THEN 2 ELSE 3 END,
          a.created_at DESC
 LIMIT 1
$function$

CREATE OR REPLACE FUNCTION private.tm_app_period_count(p_match_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(m.periods_override,c.periods,2)
 FROM public.app_matches m
 LEFT JOIN public.app_competitions c ON c.id=m.competition_id
 WHERE m.id=p_match_id
$function$

CREATE OR REPLACE FUNCTION private.tm_app_period_length(p_match_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(m.minutes_per_period_override,c.minutes_per_period)
 FROM public.app_matches m
 LEFT JOIN public.app_competitions c ON c.id=m.competition_id
 WHERE m.id=p_match_id
$function$

CREATE OR REPLACE FUNCTION private.tm_app_period_offset(p_match_id uuid, p_period text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE
   WHEN p_period='second_half' THEN coalesce(private.tm_app_period_length(p_match_id),0)
   WHEN p_period='extra' THEN greatest(2,coalesce(m.live_period_no,3)-1)*coalesce(private.tm_app_period_length(p_match_id),0)
   ELSE 0
 END
 FROM public.app_matches m
 WHERE m.id=p_match_id
$function$

CREATE OR REPLACE FUNCTION private.tm_app_period_offset_no(p_match_id uuid, p_period_no integer)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT greatest(0,coalesce(p_period_no,1)-1)*coalesce(private.tm_app_period_length(p_match_id),0)
$function$

CREATE OR REPLACE FUNCTION public.tm_app_create_private_match(p_season_id uuid, p_opponent_id uuid, p_home_away text, p_kickoff_at timestamp with time zone, p_venue_name text, p_venue_address text, p_periods integer, p_minutes_per_period integer, p_rolling_substitutions boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_uid uuid:=auth.uid();
 v_role text;
 s public.app_seasons%ROWTYPE;
 t public.teams%ROWTYPE;
 o public.app_opponents%ROWTYPE;
 c public.app_competitions%ROWTYPE;
 v_round integer;
 v_fixture uuid;
 v_match uuid;
 v_home text;
 v_away text;
 v_home_team uuid;
 v_home_opp uuid;
 v_away_team uuid;
 v_away_opp uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
 IF coalesce(v_role,'')<>'admin' THEN RAISE EXCEPTION 'Operazione riservata all’amministratore'; END IF;
 IF p_home_away NOT IN ('home','away') THEN RAISE EXCEPTION 'Casa/trasferta non valido'; END IF;
 IF p_kickoff_at IS NULL THEN RAISE EXCEPTION 'Data e ora obbligatorie'; END IF;
 IF p_periods NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Numero tempi non valido'; END IF;
 IF p_minutes_per_period NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Durata tempo non valida'; END IF;

 SELECT * INTO s FROM public.app_seasons WHERE id=p_season_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stagione inesistente'; END IF;
 SELECT * INTO t FROM public.teams WHERE id=s.team_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Squadra principale non disponibile'; END IF;
 SELECT * INTO o FROM public.app_opponents WHERE id=p_opponent_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Avversaria inesistente'; END IF;

 SELECT * INTO c
 FROM public.app_competitions
 WHERE season_id=s.id
   AND kind='friendly'
   AND coalesce((phase_rules->>'system_private_test')::boolean,false)
 ORDER BY created_at
 LIMIT 1;

 IF NOT FOUND THEN
   INSERT INTO public.app_competitions(
     season_id,name,kind,format,periods,minutes_per_period,win_points,draw_points,loss_points,
     discipline_rules,phase_rules,tier_level,phase_role,phase_format,postseason_mode,reset_standings
   ) VALUES(
     s.id,'Amichevoli / Test','friendly','single',2,40,0,0,0,
     '{}'::jsonb,jsonb_build_object('system_private_test',true),999,'regular','league','none',true
   ) RETURNING * INTO c;
 END IF;

 SELECT coalesce(max(round_no),0)+1 INTO v_round
 FROM public.app_competition_fixtures WHERE competition_id=c.id;

 IF p_home_away='home' THEN
   v_home:=t.name;v_away:=o.name;
   v_home_team:=t.id;v_home_opp:=NULL;v_away_team:=NULL;v_away_opp:=o.id;
 ELSE
   v_home:=o.name;v_away:=t.name;
   v_home_team:=NULL;v_home_opp:=o.id;v_away_team:=t.id;v_away_opp:=NULL;
 END IF;

 INSERT INTO public.app_competition_fixtures(
   season_id,competition_id,round_no,kickoff_at,home_team,away_team,
   home_team_id,home_opponent_id,away_team_id,away_opponent_id,
   venue_name,venue_address,status,home_score,away_score,source,source_imported_at,
   is_test,test_owner_id
 ) VALUES(
   s.id,c.id,v_round,p_kickoff_at,v_home,v_away,
   v_home_team,v_home_opp,v_away_team,v_away_opp,
   nullif(btrim(p_venue_name),''),nullif(btrim(p_venue_address),''),
   'scheduled',NULL,NULL,'private_calendar_test',clock_timestamp(),true,v_uid
 ) RETURNING id INTO v_fixture;

 INSERT INTO public.app_matches(
   season_id,competition_id,opponent_id,kickoff_at,venue_name,venue_address,home_away,
   round_label,status,home_score,away_score,fixture_id,live_period,is_test,test_owner_id,
   periods_override,minutes_per_period_override,rolling_substitutions,live_period_no
 ) VALUES(
   s.id,c.id,o.id,p_kickoff_at,nullif(btrim(p_venue_name),''),nullif(btrim(p_venue_address),''),
   p_home_away,'TEST','scheduled',0,0,v_fixture,'pre',true,v_uid,
   p_periods,p_minutes_per_period,coalesce(p_rolling_substitutions,false),0
 ) RETURNING id INTO v_match;

 RETURN jsonb_build_object('fixture_id',v_fixture,'match_id',v_match,'competition_id',c.id);
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_event_recalc_timing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;
  f public.app_competition_fixtures%ROWTYPE;
  v_anchor timestamptz;
  v_offset integer;
  v_period_no integer;
BEGIN
  IF NEW.captured_at IS NULL THEN NEW.captured_at:=coalesce(NEW.created_at,clock_timestamp()); END IF;

  IF OLD.minute IS DISTINCT FROM NEW.minute
     AND coalesce(NEW.payload->>'minute_origin','')<>'live_estimated' THEN
    NEW.payload:=jsonb_set(
      jsonb_set(coalesce(NEW.payload,'{}'::jsonb),'{minute_provisional}','false'::jsonb,true),
      '{minute_origin}',to_jsonb('reviewed_manual'::text),true
    );
  END IF;

  IF NEW.minute IS NULL THEN
    NEW.expected_at:=NULL;NEW.timing_delta_seconds:=NULL;NEW.timing_consistent:=NULL;
    NEW.payload:=coalesce(NEW.payload,'{}'::jsonb)||jsonb_build_object(
      'minute_missing',true,'expected_at',NULL,'timing_delta_seconds',NULL,'timing_consistent',NULL);
    RETURN NEW;
  END IF;

  SELECT * INTO m FROM public.app_matches WHERE id=NEW.match_id;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id;

  v_period_no:=coalesce(nullif(NEW.payload->>'period_no','')::integer,
    CASE coalesce(NEW.payload->>'period',m.live_period)
      WHEN 'second_half' THEN 2 WHEN 'extra' THEN greatest(3,m.live_period_no) ELSE 1 END);
  v_offset:=private.tm_app_period_offset_no(NEW.match_id,v_period_no);
  v_anchor:=private.tm_app_best_period_anchor_no(NEW.match_id,v_period_no);

  IF v_anchor IS NULL THEN
    v_anchor:=coalesce(m.live_period_started_at,m.live_started_at,f.kickoff_at);
  END IF;
  IF v_anchor IS NULL THEN RETURN NEW; END IF;

  NEW.expected_at:=v_anchor+make_interval(mins=>greatest(0,NEW.minute-v_offset)+coalesce(NEW.stoppage_minute,0));
  NEW.timing_delta_seconds:=round(extract(epoch from(NEW.captured_at-NEW.expected_at)))::integer;
  NEW.timing_consistent:=abs(NEW.timing_delta_seconds)<=300;
  NEW.payload:=coalesce(NEW.payload,'{}'::jsonb)||jsonb_build_object(
    'period_no',v_period_no,'expected_at',NEW.expected_at,
    'timing_delta_seconds',NEW.timing_delta_seconds,'timing_consistent',NEW.timing_consistent,
    'timing_tolerance_seconds',300,'minute_missing',false);
  RETURN NEW;
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_period_end_anchor_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_period text;
  v_period_no integer;
  v_len integer;
  v_end timestamptz;
  v_start timestamptz;
BEGIN
  IF NEW.event_type<>'period_end' OR NEW.validation_status='rejected' OR NEW.match_id IS NULL THEN RETURN NULL; END IF;
  v_period:=coalesce(NEW.payload->>'period','first_half');
  v_period_no:=coalesce(nullif(NEW.payload->>'period_no','')::integer,
    CASE v_period WHEN 'second_half' THEN 2 WHEN 'extra' THEN 3 ELSE 1 END);
  v_len:=private.tm_app_period_length(NEW.match_id);
  v_end:=coalesce(NEW.captured_at,NEW.created_at,clock_timestamp());
  v_start:=v_end-make_interval(mins=>v_len+coalesce(NEW.stoppage_minute,0));

  INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
  VALUES(NEW.match_id,v_period,v_period_no,'period_start',v_start,true,'period_end_derived',NEW.proposed_by,
         jsonb_build_object('from_event_id',NEW.id,'stoppage_minute',coalesce(NEW.stoppage_minute,0)));

  INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
  VALUES(NEW.match_id,v_period,v_period_no,'period_end',v_end,false,'period_end_event',NEW.proposed_by,
         jsonb_build_object('from_event_id',NEW.id));

  RETURN NULL;
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_set_period_v2(p_match_id uuid, p_period text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;
  v_now timestamptz:=clock_timestamp();
  v_seconds integer;
  v_running boolean;
  v_len integer;
  v_no integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
  IF p_period NOT IN ('halftime','second_half','extra','penalties') THEN RAISE EXCEPTION 'Periodo non valido'; END IF;
  SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR m.status<>'live' THEN RAISE EXCEPTION 'La partita non è in corso'; END IF;
  IF m.is_test AND m.test_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Match di test non accessibile'; END IF;
  v_len:=private.tm_app_period_length(m.id);

  IF p_period='halftime' THEN
    v_no:=greatest(1,m.live_period_no);
    v_seconds:=coalesce(m.live_clock_seconds,0)+CASE WHEN m.live_clock_running AND m.live_clock_anchor IS NOT NULL
      THEN greatest(0,floor(extract(epoch from(v_now-m.live_clock_anchor)))::integer) ELSE 0 END;
    v_running:=false;
  ELSIF p_period='second_half' THEN
    v_no:=2;v_seconds:=v_len*60;v_running:=true;
  ELSIF p_period='extra' THEN
    v_no:=3;v_seconds:=v_len*2*60;v_running:=true;
  ELSE
    v_no:=greatest(1,m.live_period_no);
    v_seconds:=coalesce(m.live_clock_seconds,0);v_running:=false;
  END IF;

  UPDATE public.app_matches
  SET live_period=p_period,live_period_no=v_no,live_clock_seconds=v_seconds,
      live_clock_running=v_running,live_clock_anchor=CASE WHEN v_running THEN v_now ELSE NULL END,
      live_period_started_at=CASE WHEN v_running THEN v_now ELSE live_period_started_at END,
      live_clock_estimated=false
  WHERE id=m.id;

  IF v_running THEN
    INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by)
    VALUES(m.id,p_period,v_no,'period_start',v_now,false,'period_start_action',auth.uid());
  END IF;

  RETURN jsonb_build_object('match_id',m.id,'period',p_period,'period_no',v_no,'clock_seconds',v_seconds,'running',v_running);
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_start_live_v2(p_match_id uuid, p_mode text DEFAULT 'realtime'::text, p_period text DEFAULT 'first_half'::text, p_approx_minute integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;f public.app_competition_fixtures%ROWTYPE;
  v_now timestamptz:=clock_timestamp();v_period_start timestamptz;v_first_start timestamptz;
  v_offset integer:=0;v_roster integer;v_len integer;v_no integer:=1;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato';END IF;
 IF p_mode NOT IN ('realtime','delayed') THEN RAISE EXCEPTION 'Modalità avvio non valida';END IF;
 IF p_period NOT IN ('first_half','second_half') THEN RAISE EXCEPTION 'Periodo iniziale non valido';END IF;
 IF p_approx_minute<0 OR p_approx_minute>180 THEN RAISE EXCEPTION 'Minuto approssimativo non valido';END IF;

 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Partita non collegata';END IF;
 IF m.is_test AND m.test_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Match di test non accessibile';END IF;
 IF m.status<>'scheduled' THEN RAISE EXCEPTION 'Partita già avviata o terminata';END IF;
 SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
 v_len:=private.tm_app_period_length(m.id);

 SELECT count(*) INTO v_roster FROM public.app_match_players WHERE match_id=m.id AND started;
 IF NOT m.is_test AND v_roster<>11 THEN RAISE EXCEPTION 'Prima del live servono 11 titolari (attualmente %)',v_roster;END IF;

 IF p_mode='realtime' THEN
   p_period:='first_half';p_approx_minute:=0;v_period_start:=v_now;v_first_start:=v_now;v_no:=1;
 ELSE
   v_no:=CASE WHEN p_period='second_half' THEN 2 ELSE 1 END;
   v_period_start:=v_now-make_interval(mins=>p_approx_minute);
   IF p_period='second_half' THEN v_first_start:=v_period_start-make_interval(mins=>v_len+15);v_offset:=v_len;
   ELSE v_first_start:=v_period_start;END IF;
 END IF;

 UPDATE public.app_matches
 SET status='live',live_period=p_period,live_period_no=v_no,live_started_at=v_first_start,
     live_period_started_at=v_period_start,live_period_start_estimated=(p_mode='delayed'),
     live_clock_estimated=(p_mode='delayed'),live_clock_seconds=(v_offset+p_approx_minute)*60,
     live_clock_anchor=v_now,live_clock_running=true,
     home_score=coalesce(home_score,0),away_score=coalesce(away_score,0)
 WHERE id=m.id;
 UPDATE public.app_competition_fixtures
 SET status='live',home_score=coalesce(home_score,0),away_score=coalesce(away_score,0)
 WHERE id=f.id;

 INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by,metadata)
 VALUES(m.id,p_period,v_no,'period_start',v_period_start,p_mode='delayed',
        CASE WHEN p_mode='realtime' THEN 'operator_realtime' ELSE 'operator_delayed' END,
        auth.uid(),jsonb_build_object('approx_minute',p_approx_minute));

 RETURN jsonb_build_object('match_id',m.id,'mode',p_mode,'period',p_period,'period_no',v_no,
   'approx_minute',p_approx_minute,'period_started_at',v_period_start,'clock_estimated',p_mode='delayed');
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_submit_live_event(p_match_id uuid, p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m public.app_matches%ROWTYPE;
  f public.app_competition_fixtures%ROWTYPE;
  v_uid uuid:=auth.uid();
  v_role text;
  v_trusted boolean:=false;
  v_type text;
  v_side text;
  v_player uuid;
  v_secondary uuid;
  v_minute integer;
  v_stoppage integer;
  v_reason text;
  v_notes text;
  v_count_score boolean;
  v_request_key text;
  v_minute_mode text;
  v_minute_origin text;
  v_now timestamptz:=clock_timestamp();
  v_captured timestamptz;
  v_anchor timestamptz;
  v_offset integer:=0;
  v_expected timestamptz;
  v_delta integer;
  v_consistent boolean;
  v_estimated boolean:=false;
  v_status text;
  v_payload jsonb;
  v_id uuid;
  v_period_no integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
  IF p_event IS NULL OR jsonb_typeof(p_event)<>'object' THEN RAISE EXCEPTION 'Evento non valido'; END IF;

  SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR m.fixture_id IS NULL THEN RAISE EXCEPTION 'Tabellino non collegato'; END IF;
  IF m.is_test AND m.test_owner_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Match di test non accessibile'; END IF;
  SELECT * INTO f FROM public.app_competition_fixtures WHERE id=m.fixture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fixture non disponibile'; END IF;

  IF m.status NOT IN ('scheduled','live') THEN RAISE EXCEPTION 'Inserimento live non disponibile nello stato attuale'; END IF;

  SELECT role INTO v_role FROM public.app_user_roles WHERE user_id=v_uid;
  v_role:=coalesce(v_role,'fan');
  v_trusted:=v_role IN ('admin','player');

  v_type:=nullif(p_event->>'event_type','');
  v_side:=coalesce(nullif(p_event->>'team_side',''),'team');
  IF v_type NOT IN ('goal','own_goal','penalty_scored','penalty_missed','yellow_card','blue_card','blue_return','red_card','substitution','period_end','other','assist') THEN
    RAISE EXCEPTION 'Tipo evento non valido';
  END IF;
  IF v_side NOT IN ('team','opponent') THEN RAISE EXCEPTION 'Squadra evento non valida'; END IF;

  v_player:=nullif(p_event->>'player_id','')::uuid;
  v_secondary:=nullif(p_event->>'secondary_player_id','')::uuid;
  v_minute:=nullif(p_event->>'minute','')::integer;
  v_stoppage:=nullif(p_event->>'stoppage_minute','')::integer;
  v_reason:=nullif(p_event->>'substitution_reason','');
  v_notes:=left(coalesce(p_event->>'notes',''),400);
  v_count_score:=coalesce((p_event->>'count_score')::boolean,true);
  v_request_key:=nullif(p_event->>'request_key','');
  v_minute_mode:=coalesce(nullif(p_event->>'minute_mode',''),'now_estimated');
  v_minute_origin:=coalesce(nullif(p_event->>'minute_origin',''),
    CASE WHEN v_minute IS NULL THEN CASE WHEN v_minute_mode='past_unknown' THEN 'past_unknown' ELSE 'live_estimated' END
         ELSE 'manual' END);

  IF v_minute IS NOT NULL AND (v_minute<0 OR v_minute>600) THEN RAISE EXCEPTION 'Minuto non valido'; END IF;
  IF v_stoppage IS NOT NULL AND (v_stoppage<0 OR v_stoppage>30) THEN RAISE EXCEPTION 'Recupero non valido'; END IF;
  IF v_side='opponent' THEN v_player:=NULL;v_secondary:=NULL; END IF;

  IF v_player IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.app_match_players x WHERE x.match_id=m.id AND x.player_id=v_player
      AND x.selection_status IN ('starter','bench')
  ) THEN RAISE EXCEPTION 'Giocatore non convocato'; END IF;
  IF v_secondary IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.app_match_players x WHERE x.match_id=m.id AND x.player_id=v_secondary
      AND x.selection_status IN ('starter','bench')
  ) THEN RAISE EXCEPTION 'Giocatore secondario non convocato'; END IF;

  IF v_type='substitution' AND v_side='team' THEN
    IF v_player IS NULL OR v_secondary IS NULL OR v_player=v_secondary THEN RAISE EXCEPTION 'Il cambio richiede uscente e subentrante diversi'; END IF;
    IF v_minute IS NOT NULL THEN
      IF NOT public.tm_app_player_eligible(m.id,v_player,v_minute) THEN RAISE EXCEPTION 'Il giocatore uscente non risulta in campo'; END IF;
      IF public.tm_app_player_eligible(m.id,v_secondary,v_minute) THEN RAISE EXCEPTION 'Il subentrante risulta già in campo'; END IF;
      IF NOT m.rolling_substitutions AND EXISTS(
        SELECT 1 FROM public.app_match_events e
        WHERE e.match_id=m.id AND e.validation_status IN ('official','community_confirmed')
          AND e.event_type='substitution' AND e.player_id=v_secondary
      ) THEN RAISE EXCEPTION 'Cambi non rotanti: un giocatore già uscito non può rientrare'; END IF;
    END IF;
  END IF;

  v_captured:=v_now;
  IF nullif(p_event->>'captured_at','') IS NOT NULL THEN
    BEGIN v_captured:=(p_event->>'captured_at')::timestamptz;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Timestamp evento non valido'; END;
    IF abs(extract(epoch from (v_now-v_captured)))>1800 THEN RAISE EXCEPTION 'Timestamp evento troppo distante dall’invio'; END IF;
  END IF;

  IF v_request_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.app_match_events
    WHERE match_id=m.id AND proposed_by=v_uid AND payload->>'request_key'=v_request_key LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('event_id',v_id,'duplicate',true); END IF;
  END IF;

  v_period_no:=greatest(1,coalesce(m.live_period_no,1));
  v_anchor:=private.tm_app_best_period_anchor_no(m.id,v_period_no);
  v_offset:=private.tm_app_period_offset_no(m.id,v_period_no);

  IF v_anchor IS NULL THEN
    v_anchor:=coalesce(m.live_period_started_at,m.live_started_at,f.kickoff_at);
  END IF;

  IF v_minute IS NULL AND v_minute_mode='now_estimated' AND v_anchor IS NOT NULL THEN
    v_minute:=v_offset+greatest(0,floor(extract(epoch from (v_captured-v_anchor))/60)::integer);
    v_estimated:=true;
    v_minute_origin:='live_estimated';
  ELSIF v_minute IS NOT NULL AND v_minute_origin='timer' AND coalesce(m.live_clock_estimated,false) THEN
    v_estimated:=true;
    v_minute_origin:='live_estimated';
  END IF;

  IF v_minute IS NOT NULL AND v_anchor IS NOT NULL THEN
    v_expected:=v_anchor+make_interval(mins=>greatest(0,v_minute-v_offset)+coalesce(v_stoppage,0));
    v_delta:=round(extract(epoch from (v_captured-v_expected)))::integer;
    v_consistent:=abs(v_delta)<=300;
  END IF;

  v_status:=CASE
    WHEN NOT v_trusted THEN 'proposed'
    WHEN v_estimated THEN 'official'
    WHEN v_minute IS NULL THEN 'proposed'
    WHEN v_consistent IS TRUE THEN 'official'
    ELSE 'proposed'
  END;

  v_payload:=CASE WHEN jsonb_typeof(p_event->'payload')='object' THEN p_event->'payload' ELSE '{}'::jsonb END;
  v_payload:=v_payload||jsonb_build_object(
    'entered_from','tm_app_live','request_key',v_request_key,'count_score',v_count_score,
    'counted_in_score',false,'score_applied',false,'period',m.live_period,'period_no',v_period_no,
    'captured_at',v_captured,'received_at',v_now,'expected_at',v_expected,
    'timing_delta_seconds',v_delta,'timing_consistent',v_consistent,
    'timing_tolerance_seconds',300,'minute_missing',v_minute IS NULL,
    'minute_mode',v_minute_mode,'minute_provisional',v_estimated,'minute_origin',v_minute_origin,
    'submitted_role',v_role,'notes',v_notes
  );

  INSERT INTO public.app_match_events(
    match_id,fixture_id,event_type,minute,stoppage_minute,player_id,secondary_player_id,
    payload,proposed_by,validation_status,officialized_by,officialized_at,team_side,
    substitution_reason,source,source_raw,captured_at,expected_at,timing_delta_seconds,timing_consistent
  ) VALUES(
    m.id,m.fixture_id,v_type,v_minute,v_stoppage,v_player,v_secondary,v_payload,v_uid,v_status,
    CASE WHEN v_status='official' THEN v_uid ELSE NULL END,
    CASE WHEN v_status='official' THEN v_now ELSE NULL END,
    v_side,v_reason,'live_user','{}'::jsonb,v_captured,v_expected,v_delta,v_consistent
  ) RETURNING id INTO v_id;

  INSERT INTO public.tm_app_event_reports(event_id,user_id,captured_at,submitted,merged)
  VALUES(v_id,v_uid,v_captured,p_event,false)
  ON CONFLICT(event_id,user_id) DO NOTHING;

  IF v_status='official' THEN PERFORM private.tm_app_apply_event_score(v_id); END IF;

  RETURN jsonb_build_object(
    'event_id',v_id,'status',v_status,'timing_consistent',v_consistent,
    'timing_delta_seconds',v_delta,'minute',v_minute,'minute_provisional',v_estimated,
    'minute_origin',v_minute_origin,'period_no',v_period_no,'requires_management',v_status<>'official'
  );
END
$function$

CREATE OR REPLACE FUNCTION public.tm_app_test_period_action(p_match_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 m public.app_matches%ROWTYPE;
 v_now timestamptz:=clock_timestamp();
 v_len integer;
 v_count integer;
 v_no integer;
 v_elapsed integer;
 v_semantic text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_staff() THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
 SELECT * INTO m FROM public.app_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR NOT m.is_test OR m.test_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Match di test non accessibile'; END IF;
 IF m.status<>'live' THEN RAISE EXCEPTION 'La partita non è in corso'; END IF;
 v_len:=private.tm_app_period_length(m.id);
 v_count:=private.tm_app_period_count(m.id);
 IF p_action='end' THEN
   IF m.live_period='halftime' THEN RETURN jsonb_build_object('match_id',m.id,'period_no',m.live_period_no,'waiting',true); END IF;
   v_elapsed:=coalesce(m.live_clock_seconds,0)+CASE WHEN m.live_clock_running AND m.live_clock_anchor IS NOT NULL
     THEN greatest(0,floor(extract(epoch from(v_now-m.live_clock_anchor)))::integer) ELSE 0 END;
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(m.id,m.live_period,m.live_period_no,'period_end',v_now,false,'period_end_action',auth.uid());
   UPDATE public.app_matches
   SET live_period='halftime',live_clock_seconds=v_elapsed,live_clock_running=false,live_clock_anchor=NULL
   WHERE id=m.id;
   RETURN jsonb_build_object('match_id',m.id,'period_no',m.live_period_no,'waiting',true);
 ELSIF p_action='next' THEN
   IF m.live_period<>'halftime' THEN RAISE EXCEPTION 'Termina prima il tempo in corso'; END IF;
   v_no:=m.live_period_no+1;
   IF v_no>v_count THEN RAISE EXCEPTION 'Non ci sono altri tempi configurati'; END IF;
   v_semantic:=CASE WHEN v_no=1 THEN 'first_half' WHEN v_no=2 THEN 'second_half' ELSE 'extra' END;
   UPDATE public.app_matches
   SET live_period_no=v_no,live_period=v_semantic,
       live_period_started_at=v_now,live_period_start_estimated=false,live_clock_estimated=false,
       live_clock_seconds=(v_no-1)*v_len*60,live_clock_anchor=v_now,live_clock_running=true
   WHERE id=m.id;
   INSERT INTO public.tm_app_match_time_anchors(match_id,period,period_no,anchor_kind,anchor_at,is_estimated,source,created_by)
   VALUES(m.id,v_semantic,v_no,'period_start',v_now,false,'period_start_action',auth.uid());
   RETURN jsonb_build_object('match_id',m.id,'period_no',v_no,'waiting',false);
 ELSE
   RAISE EXCEPTION 'Azione periodo non valida';
 END IF;
END
$function$


REVOKE ALL ON FUNCTION public.tm_app_create_private_match(uuid,uuid,text,timestamptz,text,text,integer,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_create_private_match(uuid,uuid,text,timestamptz,text,text,integer,integer,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_test_period_action(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_test_period_action(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_submit_live_event(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_start_live_v2(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_start_live_v2(uuid,text,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_set_period_v2(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_set_period_v2(uuid,text) TO authenticated;
