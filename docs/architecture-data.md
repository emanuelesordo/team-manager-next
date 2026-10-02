# Architettura e dati

## Stack di questa prima release

- HTML/CSS e JavaScript ES Modules statici, servibili da GitHub Pages senza processo server proprio.
- `src/config.js`: URL Supabase e chiave **publishable** (pubblica per definizione).
- `src/data.js`: accesso client Supabase, cache in memoria, letture filtrate per stagione, sessione e login Edge Function.
- `src/app.js`: routing hash, rendering dei moduli, interazioni e modali.
- `src/styles.css`: sistema visivo e breakpoint.
- `docs/`: documentazione evolutiva per tema/funzione.

## Fonte di verità

| Concetto | Fonte primaria | Nota |
|---|---|---|
| Squadra | `teams` | Potrebbe non essere visibile ad anon in RLS; fallback testuale controllato |
| Stagioni | `app_seasons` | Selezione di contesto |
| Competizioni | `app_competitions` | Regole proprie di ogni competizione |
| Fixture ufficiali | `app_competition_fixtures` | Calendario e punteggi, anche senza eventi |
| Classifica | `app_competition_standings` | View esistente; visualizzazione punti + differenza come ordinamento indicativo |
| Match operativo | `app_matches` | Riferimento della partita in gestione |
| Partecipanti | `app_match_players` | Formazione, panchina, maglia della partita |
| Eventi | `app_match_events` | Possono essere soltanto *proposed*, non ufficializzati |
| Rosa stagionale | `app_roster` | Stato e numeri eventuali |
| Anagrafica | `players` | Solo campi strettamente necessari alle viste |
| Aggregati atleta | `app_player_season_stats` | View SQL, da validare per metrica rispetto agli algoritmi completi |
| Ruoli | `app_user_roles` | Visibili secondo RLS all'utente loggato |

Il database contiene anche tabelle come `seasons`, `matches` e `match_events`: **non** sono sinonimi delle tabelle `app_*`. Nessuna fusione o eliminazione è prevista senza audit delle dipendenze.

## Associazione fixture ↔ match

Lo schema attuale non espone una foreign key diretta fixture→`app_matches`. Il frontend associa in lettura soltanto se coincidono competizione, avversaria, casa/trasferta e kickoff nell'intervallo tollerato di 36 ore **e trova un solo match operativo**. Dove manca una corrispondenza univoca, espone la fixture e dichiara assente il collegamento operativo; non genera match né eventi.

Per sviluppi successivi è consigliata una riconciliazione server-side verificata, prima di abilitare modifiche o aggiornamenti in transazione tra i due archivi.

## Cache e coerenza

La cache è volatile in memoria (`Map`) e segmentata per stagione/match; non viene persa la distinzione tra dati ufficiali e derivati. Il refresh forza il caricamento. Nessun dato applicativo è duplicato in `localStorage`, salvo la sessione gestita dal client Supabase.

## Insidie note

- L'ordinamento a punti/DR della classifica è solo rappresentativo: spareggi e scontri diretti variano per regolamento.
- La visualizzazione della formazione deriva dai titolari registrati ed è orientativa: la mappatura di `tactical_slot` su un campo semantico deve essere verificata con i dati.
- `app_player_season_stats` è un aggregato SQL esistente: l'app non inventa i valori mancanti.
- Per future scritture, usare RPC/Edge Functions transazionali con controlli server-side e audit.
