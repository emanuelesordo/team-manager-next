-- Allow the existing app_opponents/app teams alias-registration trigger
-- to insert canonical aliases when the caller is authenticated staff.
create policy "app_club_aliases_staff_insert"
on public.app_club_aliases
for insert
to authenticated
with check ((select private.is_staff()));
