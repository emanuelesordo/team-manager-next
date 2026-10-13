# Statistiche individuali · scheda giocatore

## Origine dati
Le analisi sono costruite in `fresh/player-intelligence.js` e nel motore condiviso `fresh/player-participation.js` da `app_matches`, fixture, `app_match_players`, `app_match_events` e dalle impostazioni competizione. Non sono memorizzati valori calcolati. Sono escluse le gare di test e, per la timeline individuale, sono utilizzati esclusivamente eventi `official` o `community_confirmed`.

## Intervalli in campo
- Titolare: ingresso al minuto 0, uscita alla sostituzione/espulsione.
- Subentrato: ingresso alla sostituzione, fine alla successiva uscita o al termine gara.
- Cambi ripetuti: multipli intervalli per giocatore.
- Convenzione: `player_id` sostituito; `secondary_player_id` entrante.
- I dati importati storici possono avere il minuto relativo al 2° tempo (`34′ 2T` = 74′ regolamentare), mentre gli eventi Live registrano direttamente il cumulativo (`51′` = 11′ 2T). La conversione usa l'origine dell'evento e il campo `minute_relative`.\n- Per i **minuti effettivamente giocati**, l'orologio comprende il recupero del primo tempo prima degli eventi del secondo. Il recupero da `period_end.payload.recovery_actual` ha precedenza sul recupero dichiarato `recovery_minutes`, che resta un'approssimazione in assenza del dato effettivo.\n- Lo stesso motore di intervalli viene usato dalla Rosa e dalla scheda; ingressi, uscite e minuti non devono essere ricalcolati da due algoritmi diversi.\n- Le sostituzioni `team_side=opponent` non possono cambiare la presenza di un nostro calciatore.
- Qualora `minutes_played` sia documentato, scostamenti superiori a due minuti rendono indeterminato il minutaggio ricostruito.
- Le sostituzioni importate senza identità risolta non permettono di certificare il minutaggio del titolare.
- Eventi con medesimo minuto possono avere ordine ambiguo: non interpretare i risultati come una precisione al secondo.

## Affidabilità e copertura
Le statistiche di gol in campo, gol subiti, plus/minus e stato del risultato si generano **solo** se:
1. i gol dotati di minuto corrispondono esattamente al risultato finale;
2. il lato di ogni gol è noto e ricondotto alla propria squadra;
3. gli intervalli di ingresso/uscita non sono contraddittori;
4. non mancano minuti essenziali.

Una gara incompleta mostra N/D nel plus/minus. Il contatore di copertura è visibile. Presenze, titolarità, gol, assist e cartellini visualizzati hanno come riferimento i totali stagionali di `app_player_season_stats`; i minuti della Rosa sono ricalcolati dalla timeline confermata. Quando manca la copertura per un sottoinsieme statistico viene mostrato N/D. Il recupero effettivo non noto impedisce di attribuire precisione al minuto di cronometro.

## Presentazione
La scheda utilizza blocchi principali compatti. Statistiche dello stesso ambito sono in un carosello orizzontale con scroll-snap, fruibile tramite touch, trackpad o tastiera. I grafici SVG sono leggibili senza servizi esterni: linee per andamento per partita, ciambelle per distribuzioni. Nessun valore simulato nella scheda reale.

## Definizioni
- `Gol / 80'` = gol / minuti registrati × minuti regolamentari della competizione.
- `Minuti / gol` = minuti registrati / gol.
- `Plus/minus` = gol squadra durante intervalli attivi − gol subiti negli stessi intervalli.
- `On/off` = DR normalizzata con giocatore in campo meno DR normalizzata fuori.
- `Punti dopo ingresso` = differenza dei punti virtuali da punteggio al momento dell'ingresso al risultato finale.
- Non attribuire causalità individuale da statistiche di squadra.

## Estensioni e limiti
Sono ancora necessari dati strutturati affidabili su ruoli per minuto, sinergie tra coppie, storicizzazione della forza dell'avversario alla vigilia e timeline completa per calcolare confronti avanzati senza introdurre deduzioni retrospettive. I voti esistenti sono mostrati nel pannello *Ultime valutazioni*, con la loro fonte separata.

## Verifica
`npm run check` include verifiche dei moduli `fresh/player-intelligence.js` e `fresh/player-participation.js`, e i test `tests/player-intelligence.test.mjs`, `tests/player-participation.test.mjs` e `tests/match-minutes.test.mjs`. Il caso reale verificato per Pellegrino è 13′ + 4′ + 33′ = 50′ stimati, con tre ingressi ufficiali. Questo sostituisce il precedente totale di 49′ che usava il recupero inizialmente dichiarato nella partita del 5 ottobre anziché quello effettivo.

## Riconciliazione SQL definitiva · 13/10/2026
`app_player_season_stats.minutes` e `app_player_season_stats.subentries` ora derivano dalle viste `private.tm_player_match_participation` e `private.tm_player_season_participation`. Un incontro senza eventi di fine 1T/2T confermati o con transizioni contraddittorie produce `NULL`, non minuti inventati. La UI li utilizza come fatti autoritativi; la timeline JavaScript serve per controlli e analisi di dettaglio. Il rating ponderato via RPC è stato allineato.
