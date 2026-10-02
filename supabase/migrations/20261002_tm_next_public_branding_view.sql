-- Read-only branding of discoverable teams; never expose private club/account fields. Already deployed.
CREATE OR REPLACE VIEW public.tm_public_teams AS
 SELECT id,
    name,
    short_name,
    logo_url,
    primary_color,
    secondary_color,
    accent_color,
    home_venue_name
   FROM teams
  WHERE is_discoverable IS TRUE;;
REVOKE ALL ON TABLE public.tm_public_teams FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.tm_public_teams TO anon,authenticated;
