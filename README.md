# Team Manager Next

App calcistica desktop e mobile, con Supabase esistente come unica fonte dati.

Avvio locale: `npm run dev`; verifica sintassi, test e build: `npm run check`. GitHub Pages distribuisce `dist/` dal branch `main`.

## Documentazione
- [Specifica funzionale](docs/specification-original.txt)
- [Design system](docs/design-system.md)
- [Layout e UX](docs/ui-layout.md)
- [Dati e integrità](docs/architecture-data.md)
- [Sicurezza](docs/security.md)
- [Moduli](docs/modules.md)
- [Sviluppo](docs/roadmap.md)
- [Esperienza visuale](docs/experience-04.md)
- [Amministrazione, convocazioni e live](docs/administration-and-live.md)
- [Import calendario e campo tattico](docs/import-and-tactics.md)
- [Modello simulazione classifica](docs/projections.md)
- [Account, password e ruoli](docs/account-and-roles.md)
- [Statistiche e fonti](docs/statistics-sources.md)
- [Viste derivate giocatori](docs/player-views.md)
- [Configurazione competizioni](docs/competition-configuration.md)
- [Accesso pubblico](docs/public-views.md)

Le funzionalità di consultazione presentano dati reali. Le modifiche ai risultati ufficiali, quando disponibili per gli admin, passano dalle policy RLS; sono disponibili l'editor convocazioni, la console live e l'import CSV di fixture nuove per lo staff. Necessario collaudo reale autenticato desktop/mobile.
