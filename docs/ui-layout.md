# Layout e comportamento
## Desktop
Sidebar: identità squadra, Home, Tornei, Calendario, Rosa, Statistiche, stagione, account. Topbar: contesto, stato connettività, tema, refresh e profilo.
Home: header, hero 1.62fr con carosello e ultime/prossime gare, colonna ultimi risultati/forma, sei KPI, lista e classifica in due pannelli. Competizioni: classifica e giornate. Calendario: mese e risultati. Rosa: griglia giocatori e filtri. Match Center: riepilogo, formazioni, eventi e voti. Statistiche: leaderboard basate sulle view.

## Mobile
Header dedicato, navigazione fissa in basso a cinque tab, hero semplificato, sei KPI a scorrimento orizzontale e pannelli sovrapposti, filtri in riga scrollabile, roster a tessere e dettagli a colonna singola. La selezione stagione entra nel menu a sheet. I riferimenti alle funzioni non ancora implementate non ricevono pulsanti fittizi.

## Collegamento dati
Filtro stagione applicato alle query. `app_competition_fixtures` determina calendario e risultato ufficiale. `app_matches` e le sue relazioni valgono soltanto quando la corrispondenza con fixture è univoca. Mancanza di eventi ≠ assenza certa di eventi. Nessun minuto o risultato viene inventato. Parità di punti: ordine indicativo sino alla configurazione dei criteri di spareggio.
