# Fonti statistiche: gerarchia e contratto

| Livello | Dato | Fonte unica / definizione | Consumato da |
|---|---|---|---|
| Input ufficiale | Gare, punteggi finali, sede, competizione | `app_competition_fixtures` con `status=finished` | Bilanci, classifiche, statistiche squadra, pronostici |
| Input operativo | Titolari, panchina, durata tempi | `app_matches`, `app_match_players`, `app_competitions` | Presenze e timeline |
| Input validato | Gol, assist, sostituzioni, espulsioni, fine tempi | `app_match_events` **official / community_confirmed** | Cronologia e tutti gli aggregati dipendenti da eventi |
| Input voto | Voti espressi | `app_match_ratings` | Medie e modelli di rating |
| Intermedio | Minuto cumulativo ed elapsed con recupero effettivo | `match-minutes.js`, `player-participation.js` | Tutti i periodi e gli intervalli |
| Intermedio | Intervalli in campo e copertura | `matchPlayerIntervals` | Minuti, on/off, coppie, voto ponderato |
| Intermedio | Sequenza parziali con gol riconciliati | `game-state.js` | Rimonte e situazione di punteggio |
| Finale SQL | Presenze, titolarità, gol, assist, cartellini, media voti | `app_player_season_stats` | Rosa, scheda, classifiche, tassi |
| Finale di sessione | Minuti stagionali verificati, numero ingressi confermati | `reconcilePlayerSeasonFacts` | `state.data.playerStats`, Rosa, scheda, Numeri |
| Finale risultato | V/N/P, punti, GF/GS, differenza reti | Fixture concluse ufficiali | Bilanci, profilazione, input pronostici |
| Derivato | Gol/80', assist/80', minuti/gol, on/off, co-presenza | **Solo** risultati finali + campioni verificati | Scheda, rating squadra, ipotetica |
| Modello | Pronostici, Elo, XI e voto attesi | Calcoli probabilistici | Non sostituiscono voti, risultati o classifiche |

## Contratto implementato
- Dopo il caricamento stagionale `fresh/player-season-facts.js` produce **una volta** il dataset riconciliato. Tutte le viste usano `state.data.playerStats`; `fresh/analytics-ui.js` non ricalcola indipendentemente i minuti.
- `state.data.playerSeasonFacts.perMatch` rende disponibili gli intervalli condivisi al calcolo delle coppie della formazione ipotetica. `fresh/team-rating.js` usa lo stesso `matchPlayerIntervals`.
- La vista SQL **`app_player_season_stats` è ora la fonte finale anche di `minutes`, `subentries` e `minutes_coverage`**: legge gli intervalli calcolati dalle viste interne `private.tm_player_match_participation` e `private.tm_player_season_participation`. I campi grezzi `app_match_players.minutes_played` possono restare NULL; non vengono sovrascritti.
- Una mancanza di copertura genera `null` (N/D), non uno zero oppure un totale parziale. Anche il numero di ingressi deriva da sostituzioni confermate, non dall'etichetta «panchina».
- `tm_player_recent_votes` è dettaglio delle ultime valutazioni: non è la media ufficiale della stagione, che resta `app_player_season_stats.avg_rating`.
- `app_competition_standings` è la classifica di competizione; proiezioni ed Elo non sono una fonte di classifica.
- Gli eventi proposti, contestati o rifiutati non contribuiscono alle metriche ufficiali. La loro presenza rimane consultabile per moderazione.

## Persistenza e copertura
**Riconciliazione DB completata il 13/10/2026.** I valori sono prodotti da SQL su Supabase a ogni lettura, non salvati come duplicati su righe giocatore. Il frontend confronta in lettura il motore JavaScript con la vista ufficiale e segnala discrepanze, senza rimpiazzare i valori SQL. Per le gare concluse, l'assenza di fine 1T o fine 2T con validazione ufficiale impedisce di dichiarare completi i minuti. Le partite con oltre due tempi restano N/D fino all'estensione concordata del modello temporale.

## Test
`tests/player-season-facts.test.mjs` verifica aggregazione unica, mancati caricamenti, discrepanze, rating squadra ponderato e recuperi effettivi. `tests/player-participation.test.mjs` testa i minuti misti dei periodi e le tre entrate.

## Verifiche del 13/10/2026
- 26 giocatori stagionali, 22 con presenze; 54 presenze totali, 33 titolarità e 21 subentri.
- 77 righe giocatore/partita, nessun intervallo invalido; 2.937 minuti di squadra, pari a 11 × (89 + 88 + 90).
- Pellegrino: 3 presenze, 0 titolarità, 3 subentri, 50 minuti (13 + 4 + 33).
- `public.tm_app_public_weighted_rating` usa gli stessi minuti; risultati sulle 3 gare: 6,22 / 6,09 / 6,16.
- La vista pubblica è stata verificata anche con il ruolo anon. Le viste di dettaglio sono collocate in schema `private`, senza USAGE per anon/authenticated.
- Migrazione riproducibile: `supabase/migrations/20261013_tm_shared_verified_player_facts.sql`.

## Audit trasversale delle viste e dei caroselli · 13/10/2026

| Superficie | Dati definitivi | Dettaglio/indicatore derivato | Regola adottata |
|---|---|---|---|
| Rosa, header scheda, pannello personale | `app_player_season_stats` | — | I totali provengono dalla vista SQL senza risommarli |
| Scheda · Impiego, gol/assist, disciplina | `app_player_season_stats` | Goal/subentry, medie e rate | Totali SQL; inferenze certe (es. 0 titolarità => tutti i gol da subentrato) non dipendono da una timeline esaustiva |
| Scheda · Minuti per partita | `app_player_season_stats.match_minutes` | Grafico cronologico | Il totale e ciascun punto del grafico provengono dalla stessa vista SQL; intera serie solo con copertura verificata |
| Scheda · Plus/minus, on/off, risultati e distribuzioni | Risultato delle fixture + eventi ufficiali | `matchPlayerIntervals` / `matchElapsedMinute` | Campione verificato identificato; non simulare contributi zero per partite senza timeline |
| Numeri · Marcatori, assist, minuti, rating | `app_player_season_stats` | Ranking | Non vengono ricalcolati dal dettaglio eventi |
| Numeri · Primo/secondo tempo, quarti e distribuzioni | Risultati ufficiali e timeline eventi confermati | `cumulativeEventMinute` / `matchElapsedMinute` | Minuti legacy relativi e Live cumulativi usano lo stesso convertitore; se copertura incompleta, N/D |
| Numeri · Risultati, casa/trasferta | `app_competition_fixtures` | Bilanci, margini, forma | Il risultato ufficiale resta indipendente dagli eventi |
| Numeri · Rimonte, vantaggi, game state | Fixture + sequenza gol confermata | `eventCoverage` + `game-state` | Richiesta parità degli eventi con i gol finali e ora interpretabile |
| Match center · Cronologia e parziali | Eventi confermati + punteggio fixture | `match-minutes` / `canonical-events` | Non conteggiare proposte non ufficializzate nei dati finali |
| Home · Ultima/prossima gara, rating recenti | Fixture ufficiali / voti aggregati di partita | `home-dashboard`, `player-trend` | Non sostituire risultati o voti reali con pronostici |
| Formazione ipotetica | Media voti reale / minuti validati | `player-season-facts.perMatch` e modello di posizione | Voto *atteso* distinto dal voto medio *osservato* |
| Pronostici, proiezioni | Risultati e storico ufficiali | Modelli previsionali | Output stimati, mai fatti ufficiali |
| Rating ponderato, backend e UI | Minuti validati | `tm_app_public_weighted_rating` / `team-rating` | Entrambi consumano la stessa timeline/intervalli |

Le statistiche con distribuzioni non sono campi finali autonomi: non devono sopravvivere a una modifica di gol, cambi o periodi senza essere ricalcolate. `NULL` in un dettaglio non equivale a 0. Le discrepanze tra proiezioni locali e SQL si segnalano, non si sovrascrivono.

L'audit comprende i componenti dell'app e le API esaminate; **il rendering dal browser autenticato rimane da verificare separatamente**. I test automatici validano le principali invarianti ma non certificano la completezza dei tabellini importati da servizi esterni.
