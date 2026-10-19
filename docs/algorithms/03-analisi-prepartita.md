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

## Ottobre 2026 — fasce gol incrociate, spaziature e sessioni cambi

- La distribuzione al minuto viene ricavata da **gol fatti dalla squadra che segna** e **gol subiti dalla rivale**, usando solo eventi delle fixture concluse antecedenti al kickoff. I minuti sono smussati con kernel temporale e un prior uniforme: campioni piccoli non impongono mai un minuto.
- Il modello ricava dagli stessi storici gli intervalli fra reti consecutive. Un gol allo stesso minuto di un altro ha penalità forte ma non probabilità matematica zero; 1–3 minuti di distanza ricevono penalità in funzione della frequenza osservata, con cautela aggiuntiva per due reti consecutive della stessa squadra. La procedura campiona in ordine deterministico per formazione.
- Sostituzioni: per la squadra di cui si simula la formazione, al massimo **7 ingressi**, con massimo **3 finestre durante il gioco** e una eventuale sessione HT aggiuntiva. Sostituzioni dello stesso minuto e della stessa finestra hanno lo stesso identificatore di sessione; la UI e il PNG le raggruppano.
- L'immagine 1080×1920 utilizza i colori del tema night del progetto (background #071e27, superfici #102d36, testo #effbf7 e accento #bafa96) e pittogrammi coerenti con le icone dell'app per gol, cambi e fasi di gara. Riutilizza gli eventi già simulati, senza eseguirne una nuova estrazione.
- Lo storico è limitato dagli eventi validati/disponibili: se mancano minuti o fixture collegate, tali osservazioni non sono inventate e il modello usa il prior. Le sostituzioni avversarie restano senza nomi in mancanza delle convocazioni reali.

## Ottimizzazione dei cambi — sfruttare la panchina

- Obiettivo del simulatore: impiegare fino a tutti i sette cambi quando il risultato **consente turnover** o **richiede una risposta tattica**, anziché limitarsi a tre o quattro entrate per impostazione.
- Con almeno sette riserve utilizzabili: margine del risultato simulato finale pari o superiore a due reti (vantaggio o svantaggio) → puntare a sette ingressi; scarto di una rete → sei; parità → cinque. Con panchina più corta, massimo quanto effettivamente disponibile. Sono obiettivi euristici e non un obbligo regolamentare.
- I cambi restano raggruppati in tre sessioni di gioco al massimo, con ulteriore sessione possibile all'intervallo. Se si è in svantaggio la sessione finale non viene annullata: i subentranti offensivi ricevono maggiore peso; se si difende un largo vantaggio si privilegiano rotazione e copertura.
- I calciatori già subentrati non possono essere sostituiti in un secondo momento nella simulazione standard. Non vengono inventate presenze o giocatori.
