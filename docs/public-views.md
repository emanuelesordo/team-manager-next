# Vista pubblica squadra

Migrazione Supabase `team_manager_next_public_branding_view` (applicata): `tm_public_teams` è una vista filtrata su `is_discoverable IS TRUE` con i soli campi `id, name, short_name, logo_url, primary_color, secondary_color, accent_color, home_venue_name`. Permessi di lettura a `anon` e `authenticated`. La tabella `teams` e le sue policy non sono state aperte agli ospiti. Nessun dato sportivo o storico è stato modificato.
