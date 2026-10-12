# Confronto, attenzione e narrativa prepartita

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

**Sorgenti:** `fresh/pre-match-prediction.js` (`comparisonMetrics`, `situationalMetrics`, `attentionPoints`, `matchNarrative`); `fresh/pre-match-prediction-ui.js`.

## ATTUALE
- Confronti: punti/gara, GF/gara, GS/gara, DR/gara, forma recente e fasce di maggiore efficacia/vulnerabilità.
- Pattern di attenzione: forma crescente/calante, primo gol, rimonte, tenuta del vantaggio, espulsioni, gol di pareggio/accorciamento/allungo, reazioni entro 10 minuti e bilancio offensivo.
- I pattern hanno soglie minime (per esempio almeno due osservazioni in vari indicatori) e `attentionPoints` restituisce al massimo 8 elementi.
- La narrativa è costruita da `matchNarrative` usando probabilità, punteggio modale, forma, rango, xG, caratteristiche del campo e pattern di game state; il minuto medio generico dei gol non viene usato come segnale. `stableChoice` seleziona varianti deterministiche dal seed della fixture.
- La UI stampa il testo restituito dal modello; non deve inventare caratteristiche o riscrivere valori.

## Requisiti di qualità
Ogni affermazione quantitativa deve avere un dato effettivo a supporto; distinguere fatti osservati, piccole evidenze e deduzioni probabilistiche. Non attribuire ad avversarie statistiche di eventi non coperte da dati affidabili.

## DA VALIDARE
Ripetitività tra partite simili, eccesso di frasi standard, presenza di pattern non rappresentativi, prevalenza di eventi incompleti. Per testi veramente distinti va rivista la composizione, non semplicemente aumentata la casualità.
