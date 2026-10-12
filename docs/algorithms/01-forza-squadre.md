# Potenziale e forza squadre

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

**Sorgente:** `fresh/pre-match-prediction.js`: `historicalPrior`, `historicalWeight`, `strengthRows`, `rankBucket`.

## ATTUALE
- Identità `team:<id>` / `opponent:<id>`; solo gare della competizione concluse con due punteggi interi.
- Forma corrente: 40% punti per gara normalizzati, 30% ultime cinque gare pesate, 15% differenza reti, 7,5% attacco, 7,5% difesa.
- Segnale strutturale corrente: 45% punti, 25% DR, 15% attacco, 15% difesa.
- Potenziale atteso: storia (quando esiste) corretta progressivamente dal segnale strutturale; non coincide con l'attuale posizione in classifica.
- Forza della competizione: miscela corrente + prior storico (quota storica massima 22%, variabile con le gare disputate).
- Categoria rivale: più forte se differenza di potenziale >0,075; più debole se <−0,075; altrimenti simile.
- Le medie dei gol sono regolarizzate verso la media della competizione quando i campioni sono piccoli.

## Invarianti
Potenziale, forza, tassi offensivi/difensivi e rango devono essere calcolati sullo stesso snapshot antecedente alla partita. Distinguere livello teorico da forma recente.

## DA VALIDARE
Calibrazione pesi, ordinamenti a potenziale molto simile, qualità degli storici incompleti e gestione di competizioni/fasi con pochi incontri.
