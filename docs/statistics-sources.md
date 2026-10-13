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
- Nel database corrente `app_player_season_stats.minutes` è 0 perché `app_match_players.minutes_played` è nullo nelle gare giocate. **Non rappresenta i minuti reali** e viene rimpiazzato solamente se la timeline è verificabile.
- Una mancanza di copertura genera `null` (N/D), non uno zero oppure un totale parziale. Anche il numero di ingressi deriva da sostituzioni confermate, non dall'etichetta «panchina».
- `tm_player_recent_votes` è dettaglio delle ultime valutazioni: non è la media ufficiale della stagione, che resta `app_player_season_stats.avg_rating`.
- `app_competition_standings` è la classifica di competizione; proiezioni ed Elo non sono una fonte di classifica.
- Gli eventi proposti, contestati o rifiutati non contribuiscono alle metriche ufficiali. La loro presenza rimane consultabile per moderazione.

## Persistenza e copertura
Al momento minuti e subentri verificati sono **finali per la sessione frontend**, non per il database. La vista SQL non è stata modificata. Un futuro servizio server-side dovrebbe condividere la stessa definizione, essere confrontato con queste metriche e diventare fonte per applicazioni esterne prima di sostituire valori esistenti.

## Test
`tests/player-season-facts.test.mjs` verifica aggregazione unica, mancati caricamenti, discrepanze, rating squadra ponderato e recuperi effettivi. `tests/player-participation.test.mjs` testa i minuti misti dei periodi e le tre entrate.
