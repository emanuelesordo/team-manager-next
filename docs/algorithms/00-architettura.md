# Algoritmi prepartita — mappa e protocollo

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

## Pipeline attuale
1. Dati delle fixture, competizioni, storico, profili campo, tabellini ed eventi -> `predictMatch` in `fresh/pre-match-prediction.js`.
2. Il pronostico produce forza, potenziale, expected goals, probabilità 1/X/2, risultati esatti, confronti, fattori situazionali, punti di attenzione e testo narrativo.
3. `renderPreMatchPrediction` in `fresh/pre-match-prediction-ui.js` presenta i risultati senza ricalcolare il pronostico.
4. `buildHypotheticalLineup` in `fresh/pre-match-lineup.js` utilizza fixture, rosa, convocazioni, voti, eventi e parte degli output del pronostico; `renderHypotheticalLineup` visualizza.

## Confini
- Fonte di verità dei calcoli: codice JS eseguito. Questi MD sono specifiche versionate.
- Il modello di **proiezione classifica** è separato: `fresh/projection.js`, `docs/projections.md`.
- Dati post-gara non utilizzabili per pronostici relativi a una partita passata.
- Il valore 'copertura dati' non è una probabilità di correttezza.

## Documenti
- [01-forza-squadre.md](01-forza-squadre.md)
- [02-pronostici.md](02-pronostici.md)
- [03-analisi-prepartita.md](03-analisi-prepartita.md)
- [04-formazione-ipotetica.md](04-formazione-ipotetica.md)
- [05-storico-statistico.md](05-storico-statistico.md)
- [06-validazione.md](06-validazione.md)

## Procedura modifica
Richiesta -> confronto con codice -> aggiornamento della specifica -> implementazione -> test automatici e regressione -> commit -> verifica workflow e pagina pubblicata. Se si aggiorna solo un MD, **non** cambia alcuna previsione nell'app.
