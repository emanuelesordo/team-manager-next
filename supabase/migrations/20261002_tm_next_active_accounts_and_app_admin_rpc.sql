-- Active profiles are required for both staff and admin checks. Already deployed.
CREATE OR REPLACE FUNCTION private.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM public.app_user_roles ar
   JOIN public.profiles p ON p.id=ar.user_id
   WHERE ar.user_id=(SELECT auth.uid()) AND p.is_active IS TRUE
     AND ar.role IN ('admin','manager')
 );
$function$
;
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM public.app_user_roles ar
   JOIN public.profiles p ON p.id=ar.user_id
   WHERE ar.user_id=(SELECT auth.uid()) AND p.is_active IS TRUE AND ar.role='admin'
 );
$function$
;
CREATE OR REPLACE FUNCTION public.tm_app_manage_account(p_user_id uuid, p_role text DEFAULT NULL::text, p_player_id uuid DEFAULT NULL::uuid, p_set_player boolean DEFAULT false, p_active boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 old_role public.app_user_roles%ROWTYPE;
 account public.profiles%ROWTYPE;
 new_role text;
 new_player uuid;
 updated_active boolean;
 team_uuid uuid;
 admins_left integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN
  RAISE EXCEPTION 'Gestione account riservata agli amministratori';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tm_app_admin_accounts',0));
 SELECT * INTO account FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account inesistente'; END IF;
 SELECT * INTO old_role FROM public.app_user_roles WHERE user_id=p_user_id FOR UPDATE;
 new_role:=coalesce(p_role,old_role.role,'fan');
 IF new_role NOT IN ('admin','manager','coach','player','fan') THEN RAISE EXCEPTION 'Ruolo non valido'; END IF;
 new_player:=CASE WHEN p_set_player THEN p_player_id ELSE old_role.player_id END;
 IF new_player IS NOT NULL THEN
  SELECT s.team_id INTO team_uuid FROM public.app_seasons s
   ORDER BY (s.status='active') DESC,s.start_date DESC LIMIT 1;
  IF team_uuid IS NULL OR NOT EXISTS(SELECT 1 FROM public.players p WHERE p.id=new_player AND p.team_id=team_uuid)
   THEN RAISE EXCEPTION 'Giocatore non appartenente alla squadra';END IF;
  IF EXISTS(SELECT 1 FROM public.app_user_roles r WHERE r.player_id=new_player AND r.user_id<>p_user_id)
   THEN RAISE EXCEPTION 'Giocatore già associato a un altro account';END IF;
 END IF;
 updated_active:=coalesce(p_active,account.is_active);
 IF old_role.role='admin' AND (new_role<>'admin' OR NOT updated_active) THEN
  SELECT count(*) INTO admins_left
  FROM public.app_user_roles a JOIN public.profiles pr ON pr.id=a.user_id
  WHERE a.role='admin' AND pr.is_active AND a.user_id<>p_user_id;
  IF admins_left=0 THEN RAISE EXCEPTION 'Non è possibile disattivare l’ultimo amministratore';END IF;
 END IF;
 INSERT INTO public.app_user_roles(user_id,role,player_id)
 VALUES(p_user_id,new_role,new_player)
 ON CONFLICT(user_id) DO UPDATE
 SET role=EXCLUDED.role,player_id=EXCLUDED.player_id;
 UPDATE public.profiles SET is_active=updated_active WHERE id=p_user_id;
 RETURN jsonb_build_object('ok',true,'user_id',p_user_id,'role',new_role,
    'player_id',new_player,'active',updated_active);
END $function$
;
CREATE OR REPLACE FUNCTION public.tm_app_update_profile(p_display_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE clean_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active)
 THEN RAISE EXCEPTION 'Account non attivo';END IF;
 clean_name:=btrim(coalesce(p_display_name,''));
 IF length(clean_name)<2 OR length(clean_name)>90 THEN
  RAISE EXCEPTION 'Nome pubblico: da 2 a 90 caratteri';END IF;
 UPDATE public.profiles SET display_name=clean_name WHERE id=auth.uid();
 RETURN jsonb_build_object('ok',true,'display_name',clean_name);
END $function$
;
REVOKE ALL ON FUNCTION public.tm_app_manage_account(uuid,text,uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_manage_account(uuid,text,uuid,boolean,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.tm_app_update_profile(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tm_app_update_profile(text) TO authenticated;
