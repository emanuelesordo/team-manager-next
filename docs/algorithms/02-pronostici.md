# Pronostico e risultati esatti

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

**Sorgente:** `fresh/pre-match-prediction.js`: `predictMatch`, `outcomeProbabilities`, `predictionSignature`.

## ATTUALE
- Richiede fixture/competizione e squadre riconosciute; esclude gare annullate e, salvo modalità retrospettiva, gare già live/concluse.
- Usa solo fixture completate della stessa competizione con kickoff anteriore al match analizzato.
- Calcola due medie gol attese (lambda casa/trasferta) da attacco e difesa smussati, vantaggio campo, differenza forza, divario storico e correttivi situazionali; lambda finali limitate fra 0,15 e 4,5.
- Correttivo contestuale: 27% rendimento contro rango comparabile, 12% gestione vantaggio/svantaggio, 15% stato-gara, 15% superiorità numerica, 15% profilo campo, 10% pattern sul parziale e reazioni dopo i gol, 6% forma corretta per rango. Queste sono quote del **correttivo**, non del modello totale.
- La forma corretta per avversaria usa solo storico precedente e risultati già conclusi, e resta neutra sotto due precedenti validi. Campo simile: almeno 2 precedenti per applicare il delta. Il vecchio incrocio dei minuti medi dei gol è stato rimosso: il correttivo evento usa pareggi, accorciamenti, vantaggi concessi e reazioni entro 10 minuti. Eventi con campione scarso non devono forzare il pronostico.
- Probabilità punteggio con due distribuzioni di Poisson indipendenti, enumerando 0–10 gol per ciascuna squadra e normalizzando sulla griglia.
- Il punteggio mostrato è la **moda della distribuzione dei risultati esatti**, NON l'arrotondamento dei gol attesi. Mostra probabilità e due alternative, oltre al totale 1/X/2.
- `coverage` indica copertura dei dati e non accuratezza/calibrazione statistica.

## Da testare
Somma 1/X/2 ≈ 1; somma probabilità dei risultati enumerati ≈ 1 dopo normalizzazione; tre risultati ordinati decrescenti; assenza di leakage; output deterministico con input identico; probabilità mai negative/NaN.

## DA VALIDARE
Adeguatezza dell'indipendenza delle Poisson, calibrazione degli xG e delle probabilità, sensibilità ai piccoli campioni e agli storici.
