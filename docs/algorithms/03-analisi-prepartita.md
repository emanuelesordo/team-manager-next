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

## Aggiornamento 19/10/2026 — Overview a cinque viste e scenario simulato

- Overview prepartita a carosello orizzontale con wrap circolare tramite frecce: **Pronostico → Numeri delle squadre → Focus → Formazione ipotetica → Simulazione**.
- La pagina conserva confronti e focus elaborati dal modello, spostando i rispettivi blocchi nelle slide senza inventare statistiche.
- La simulazione è deterministica per fixture e formazione selezionata (fresh/pre-match-simulation.js), usa il risultato esatto modale, i gol attesi e le fasce storiche dei gol se presenti.
- I cambi sono **eventi ipotetici**, mai reali: impiegano giocatori disponibili e non già in campo, considerando ruoli, minutaggio storico e stato del punteggio. Non vengono scritti eventi nel database.
- Cambiando una delle nove formazioni, la timeline si aggiorna per l'undici selezionato.
- Carosello esterno e scorrimento interno delle nove formazioni sono indipendenti.
- **Da validare**: disponibilità completa dei minutaggi delle avversarie, vincoli regolamentari sulle sostituzioni e capacità predittiva attraverso test retrospettivi. La timeline è illustrativa, non probabilisticamente calibrata per ogni evento.

## Aggiornamento — marcatori probabilistici ed esportazione 9:16

- La quantità di reti resta ancorata allo **score esatto modale** del modello pre-gara, mentre i marcatori e gli assist sono campionati con pesi dipendenti dal ruolo nello XI, dal rendimento atteso e dai gol/assist per presenza laddove osservati. Tutti i calciatori hanno un peso di base non nullo, anche senza reti storiche. Dopo un gol, il peso dello stesso calciatore diminuisce per evitare triplette meccaniche, senza renderle impossibili.
- Ogni gol del Caselle mostra marcatore, assistman quando coerente con la dinamica e descrizione dell'azione (cross, imbucata, corner, ripartenza, tiro da fuori, punizione, azione individuale). Le dinamiche non rappresentano eventi osservati, ma narrazione simulata.
- I cambi sono generati in ordine cronologico rispetto alle reti, aggiornano i giocatori effettivamente in campo e rispondono a punteggio, compatibilità di reparto e minuti per presenza; l'ingresso di un giocatore esclude un secondo ingresso dello stesso calciatore.
- La sezione **Simulazione** non ripete qualificatori di incertezza per ogni evento: un unico disclaimer identifica la natura sintetica della timeline.
- Il pulsante **Genera immagine 9:16** esporta un PNG 1080×1920 tramite Canvas nel browser, utilizzando **l'oggetto dello scenario già visualizzato** e non una nuova estrazione casuale. Su browser compatibili propone condivisione nativa; negli altri scarica il file. Nessun evento è scritto a DB.
- Limiti dichiarati: assenza di storico eventi dettagliato per l'avversario, dinamiche simulate da prior euristici, non da un modello calibrato evento-per-evento. Per migliorare le probabilità servono dati su partecipazioni, tiri, assist e minuti reali per ruolo.
