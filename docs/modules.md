# Moduli funzionali

## Home

Carosello con prossimo incontro, ultimo incontro e posizione attuale (solo con dati presenti). KPI sulla squadra e forma recente derivati dai risultati ufficiali; se l'utente è associato a un giocatore mediante `app_user_roles.player_id`, mostra una scheda personale sintetica. Nessuna statistica personale inventata.

## Competizioni

Selezione competizione. Classifica da `app_competition_standings` e fixture ufficiali per mese, anche delle avversarie. Filtro "Solo squadra". Non presenta la classifica euristica come classifica ufficiale.

## Calendario

Partite della squadra per data, filtro da giocare/concluse/tutte e competizione. Tap/click di qualunque fixture: Match Center.

## Rosa

Giocatori della rosa stagionale attiva; ricerca testuale interamente client-side (senza richieste al DB per ogni carattere); filtro ruolo; scheda individuale e statistiche della stagione da view esistente.

## Statistiche

Risultati squadra computati dalle fixture della squadra; ultimi gol per gara; marcatori/assist/presenze individuali solo se esistono nelle view. Nessun conteggio su panchinari mai entrati, inventato lato UI.

## Match Center (primo stadio consultivo)

Stessa scheda logica per programmato/concluso; tab Riepilogo, Formazioni, Eventi. Risultato ufficiale deriva dalla fixture; i dati operativi dalla partita collegata. Gli eventi mostrano il relativo stato di validazione. Gli eventi senza minuto riportano **s.m.**, senza minuti fittizi. Tutti gli aggiornamenti live/sostituzioni/cartellini/tempi e votazioni rimangono disabilitati in questa release di base: necessitano di interventi transazionali.

## Accesso e setup

Login `auth-login` (username + password), `setSession` con access/refresh token del client Supabase; ruoli letti da `app_user_roles`. Il setup è una pagina informativa temporanea: non simula pulsanti di salvataggio. Il backend RLS governa letture/scritture indipendentemente dalla visualizzazione.


## Dashboard analitiche

- Home: KPI sintetici e trend reti, risultati W/N/P, classifica compatta, agenda e distribuzione della rosa.
- Statistiche: analisi ultimi incontri, dettaglio bilancio, split casa/trasferta, marcatori registrati e ruoli.
- Competizioni: barra completamento fixture calcolata per la competizione/filtri correnti.
- Rosa: composizione per ruolo su una riga, filtri e ricerca immutati.
- Tutte le rappresentazioni derivano dai dati ufficiali `app_competition_fixtures` e dalle viste/stagioni esistenti; la disponibilità della metrica non implica che sia nota la sequenza degli eventi.
