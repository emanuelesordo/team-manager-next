# Storico, attendibilità e dati antecedenti

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

**Sorgente:** `fresh/pre-match-prediction.js`: `historicalPrior`, `historicalWeight`, `strengthRows`; `fresh/pre-match-lineup.js`: `ratingAverages`, `recencyMap`.

## ATTUALE
- Storico: fino a cinque stagioni per squadra, ordinate dall'anno più recente; coefficienti cronologici [1; 0,72; 0,52; 0,38; 0,28].
- Per ogni anno combinazione: 60% livello serie, 17% quota punti ottenuti, 9% posizione relativa, 7% DR e 7% produzione/tenuta gol.
- Livello serie pesa maggiormente: tier 1=1; tier 2=0,68; tier 3=0,36. Mancanze dati sono gestite con valori neutri/fallback nel codice.
- Peso storico decresce al crescere delle gare della fase, ed entra anche nelle stime gol all'inizio della stagione.
- La forma recente è calcolata sulle ultime cinque partite, pesando maggiormente quelle più nuove.

## Attenzione
Una stagione 'più recente' nel codice deriva dal sort di `season_start_year`; verificare continuità e attendibilità reale delle stagioni archiviate. Non presumere che cinque record significhino cinque stagioni consecutive.

## DA VALIDARE
Controllare per ogni squadra presenza di storico, serie/livello e partite valide. Valutare robustezza con valori nulli e cambi di formato della competizione.
