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
- [Notifiche](docs/notifications.md)
- [Variazioni tattiche live](docs/live-tactics.md)
- [Riconciliazione dati e conflitto storico](docs/database-reconciliation.md)
- [Accesso pubblico](docs/public-views.md)

Le funzionalità di consultazione presentano dati reali. Le modifiche ai risultati ufficiali, quando disponibili per gli admin, passano dalle policy RLS; sono disponibili l'editor convocazioni, la console live e l'import CSV di fixture nuove per lo staff. Necessario collaudo reale autenticato desktop/mobile.

## Integrità sportiva
Nell'amministrazione è disponibile il controllo manuale in sola lettura delle anomalie su tabellini, fixture, formazione ed eventi, tramite RPC `tm_app_integrity_report`.

## Collegamento diretto alla partita
Il Match Center conserva la fixture nell'URL (`#match/<uuid>`). Aggiornamento del browser e accessi successivi ricostruiscono la partita dalla fonte Supabase; formazioni ed eventi vengono riletti dal database. Test di regressione dedicato agli URL.

## Revisione postpartita
In Match Center → Gestione → Eventi lo staff può approvare/scartare proposte anche dopo la chiusura della partita. La RPC `tm_app_review_event` controlla ruolo e stato concorrente, non altera punteggi e conserva gli eventi scartati per la tracciabilità. Risultato ufficiale e conteggio eventi restano distinti come da specifiche.

## Revisione postpartita approfondita
La partita conclusa è distinta dal risultato confermato (`app_matches.result_review_status`). In Gestione → Eventi si possono rettificare tipo, lato, giocatori, minuti, recupero, motivo e note con giustificazione obbligatoria; lo stesso ID evento è mantenuto e lo storico append-only è visibile solo allo staff. Dopo ogni rettifica l'evento torna proposto. Il risultato può essere confermato solo con fixture/tabellino conclusi, punteggi coerenti e nessuna proposta aperta. Un cambio di risultato o evento revoca la conferma. La fixture resta fonte ufficiale; l'allineamento del solo tabellino richiede una conferma umana.
