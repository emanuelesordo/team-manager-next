# Statistiche individuali · scheda giocatore

## Origine dati
Le analisi sono costruite in `fresh/player-intelligence.js` da `app_matches`, fixture, `app_match_players`, `app_match_events` e dalle impostazioni competizione. Non sono memorizzati valori calcolati. Sono escluse le gare di test e gli eventi rifiutati/contestati.

## Intervalli in campo
- Titolare: ingresso al minuto 0, uscita alla sostituzione/espulsione.
- Subentrato: ingresso alla sostituzione, fine alla successiva uscita o al termine gara.
- Cambi ripetuti: multipli intervalli per giocatore.
- Convenzione: `player_id` sostituito; `secondary_player_id` entrante.
- Minutaggio cumulativo: `cumulativeEventMinute`; durata regolamentare configurata; recupero da `period_end.payload`, quando disponibile.
- Qualora `minutes_played` sia documentato, scostamenti superiori a due minuti rendono indeterminato il minutaggio ricostruito.
- Le sostituzioni importate senza identità risolta non permettono di certificare il minutaggio del titolare.
- Eventi con medesimo minuto possono avere ordine ambiguo: non interpretare i risultati come una precisione al secondo.

## Affidabilità e copertura
Le statistiche di gol in campo, gol subiti, plus/minus e stato del risultato si generano **solo** se:
1. i gol dotati di minuto corrispondono esattamente al risultato finale;
2. il lato di ogni gol è noto e ricondotto alla propria squadra;
3. gli intervalli di ingresso/uscita non sono contraddittori;
4. non mancano minuti essenziali.

Una gara incompleta mostra N/D nel plus/minus. Il contatore di copertura è visibile. I gol e gli assist personali restano informativi se presenti come eventi, ma non certificano la completezza dello storico.

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
`npm run check` include `node --check fresh/player-intelligence.js` e `node --test tests/player-intelligence.test.mjs`.
