# Formazione ipotetica e voti attesi

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

**Sorgente:** `fresh/pre-match-lineup.js`: `buildHypotheticalLineup`, `eligibleRoster`, `availabilityFor`, `modalFormation`, `playerScores`, `coPlayMap`, `bestForSlot`, `expectedRatingFor`, `renderHypotheticalLineup`.

## ATTUALE
- Disponibile per la squadra principale, non per l'avversaria; richiede dati squadra, partita e rosa.
- Seleziona gare concluse anteriori al kickoff; privilegia avversarie di potenziale comparabile indicate dal pronostico, oppure le ultime 4 gare.
- Sceglie modulo frequente sul campione; filtra rosa per eleggibilità temporale e disponibilità; non deve proporre indisponibili.
- Per ogni slot seleziona un giocatore non ancora usato tramite ruolo, esperienza nello slot, frequenza titolare, risultati, voti contestuali, sinergia dei compagni e carico recente.
- Turnover morbido solo per gare relativamente favorevoli; il portiere è quasi esente.
- `expectedRatingFor`: combinazione 55% media storica e 45% media contestuale quando entrambe presenti, più correttivi limitati di sinergia e risultato. Se nessun voto affidabile esiste, il valore può essere nullo: non inventarlo.
- Ritorna `players`, `xiExpectedRating`, `sampleSize`, `confidence`, `rotationOpportunity`; renderer mostra **atteso** e **medio** sotto il giocatore.

## Problema aperto (DA VALIDARE)
In precedenti verifiche dell'interfaccia i voti attesi/medi non risultavano visibili. Occorre ispezionare dati in ingresso, mappe dei rating, attributi ritornati da `expectedRatingFor` e CSS/render: non assumere che sia già corretto.

## Test richiesti
Nessun ID doppio; nessun non tesserato alla data; nessun indisponibile; rispetto del ruolo portiere; null rating mostrato come trattino; nessun evento/post-match futuro; comportamento con meno di 11 disponibili.
