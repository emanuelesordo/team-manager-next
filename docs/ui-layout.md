# UI layout — raggruppamento dei contenuti

## Contesto principale

Squadra → Stagione → Competizione → Fixture. Rosa stagionale e giocatori anagrafici persistenti. La consultazione mobile e l'operatività desktop usano le stesse query e gli stessi dati.

## Home

MATCH DAY: carosello prossimo match / ultimo match / posizione attuale, quando disponibili.
BILANCIO: incontri giocati, vittorie, pareggi, sconfitte, gol fatti/subiti.
APPROFONDIMENTO: programma, risultati recenti, classifica ufficiale, andamento.
MY PLAYER: visibile con dati soltanto a un utente autenticato collegato a player_id.

## Competizioni

Selezione torneo, classifica completa, incontri raggruppati per mese, switch Solo squadra. La classifica deriva da app_competition_standings. Posizioni a pari punti restano indicative se lo spareggio specifico della competizione non è implementato.

## Calendario

Filtri Da giocare / Risultati / Tutte + competizione. Fixture con squadra casa, logo, punteggio, logo, squadra trasferta e campo. Ogni riga apre Match Center.

## Match Center

Scheda unica programmata/live/conclusa con tab Riepilogo, Formazioni ed Eventi.
App_competition_fixtures è autorevole per calendario e score.
App_matches, app_match_players, app_match_events sono fonti operative separate.
Non fabbricare marcatori, minuti, riconciliazioni o link ad app_matches ambigui.

## Rosa e giocatore

Card per ruolo P/D/C/A, ricerca locale, scheda dettagliata con statistiche solo esistenti nella view, senza conteggiare una panchina inutilizzata come presenza. Stagione sempre esplicita.

## Statistiche

Bilancio squadra, distribuzione gol sulle partite registrate, classifica marcatori, dati personali quando disponibili. Non simulare indicatori che mancano all'origine.

## Admin e gestione (evoluzione)

Setup squadra e stagione; avversarie; competizioni; import; disponibilità, convocazioni, formazioni, console live, eventi e votazioni; proiezioni di classifica e moduli PRO. Sono attività da completare: nessun controllo di modifica simulato deve essere presentato come funzionante.

Ogni modifica di fixture + match operativo richiede validazione di PK/FK/unique/check, policy RLS, transazione verificata, prevenzione duplicati e conservazione dello storico.

## Responsive e sicurezza

Desktop: layout modulare multi-colonna con sidebar. Mobile: paletta avorio/verde, priorità partite e risultati, bottom nav e bottom-sheet. Tutte le variazioni di accesso devono essere applicate da Supabase/RLS, non solo dall'interfaccia.
