-- Venue characteristics used by the statistical pre-match predictor.
alter table public.venues
  add column if not exists surface_type text,
  add column if not exists width_profile text,
  add column if not exists length_profile text;

alter table public.venues
  drop constraint if exists venues_surface_type_chk,
  add constraint venues_surface_type_chk
    check (surface_type is null or surface_type in ('natural','synthetic','hybrid')),
  drop constraint if exists venues_width_profile_chk,
  add constraint venues_width_profile_chk
    check (width_profile is null or width_profile in ('narrow','standard','wide')),
  drop constraint if exists venues_length_profile_chk,
  add constraint venues_length_profile_chk
    check (length_profile is null or length_profile in ('short','standard','long'));

drop policy if exists app_venues_staff_manage on public.venues;
create policy app_venues_staff_manage
on public.venues
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

drop policy if exists app_venues_public_read on public.venues;
create policy app_venues_public_read
on public.venues
for select
to anon
using (true);

revoke select on public.venues from anon;
grant select (
  id, team_id, name, address_line, city, province, country,
  is_opponent_venue, surface_type, width_profile, length_profile
) on public.venues to anon;

insert into public.venues(team_id,name,address_line,city,province,is_opponent_venue)
select distinct s.team_id, btrim(coalesce(f.venue_name,f.venue)), null, null, null, true
from public.app_competition_fixtures f
join public.app_seasons s on s.id=f.season_id
where nullif(btrim(coalesce(f.venue_name,f.venue)), '') is not null
  and not exists (
    select 1 from public.venues v
    where v.team_id=s.team_id
      and lower(regexp_replace(btrim(v.name),'[^[:alnum:]]+','','g')) =
          lower(regexp_replace(btrim(coalesce(f.venue_name,f.venue)),'[^[:alnum:]]+','','g'))
  );
