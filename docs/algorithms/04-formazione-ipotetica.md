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

## Aggiornamento 19/10/2026 — affinità e intenzioni del mister

- Per ogni slot, il modello consulta `app_player_role_affinities` e `football_positions` caricati in `loadSeason`. Considera la percentuale esplicita e la distanza della zona del ruolo rispetto allo slot: **0% non è un ruolo adatto**, mentre un profilo non ancora compilato usa la categoria generica come prior di ripiego. Il 100% naturale ha più influenza.
- La propensione dell'allenatore alla titolarità è stimata dalle distinte storiche quando contengono almeno dieci voci e distinguono i presenti dagli assenti. Si pesano il rango comparabile dell'avversario e il risultato, senza dedurre che un giocatore fosse disponibile in gare prive di registrazioni.
- Il modulo continua a dipendere dalle formazioni effettive, dai risultati e dall'attinenza rispetto al rango. Il turnover rimane un **correttivo limitato** quando l'avversario risulta abbordabile in termini di probabilità/potenziale; non si inventano presenze o minuti non osservati.
- Attenzione: l'analisi delle intenzioni del mister è un segnale statistico e non una previsione certa; l'affinità dichiarata dallo staff è distinta dalle performance realmente osservate.
- DA VALIDARE con gare reali: cambi di modulo determinati dalle assenze, alternative ad alto/minor minutaggio contro diversi ranghi, e confronto dell'XI ipotetico con le scelte ufficiali.

## Aggiornamento 19/10/2026 — tre soluzioni tattiche

- Il generatore valuta tutti i moduli supportati considerando gli **undici ruoli da coprire**, la compatibilità individuale dei disponibili, la frequenza delle scelte precedenti del mister e i risultati ponderati per rango avversario.
- Anche il modulo storico più frequente può essere superato se la rosa disponibile permette una copertura migliore con un altro schieramento. I moduli storicamente preferiti ricevono un bonus limitato.
- Seleziona tre moduli distinti ordinati per punteggio tattico composito: proposta principale e due alternative. Le tre formazioni hanno titolari e voti attesi calcolati separatamente; la stessa persona non può occupare due posizioni nella medesima proposta.
- Il carosello nell'Overview si scorre orizzontalmente su mobile e tramite frecce da desktop, conservando il formato del campo e la gerarchia visiva del progetto.
- **Da validare:** il punteggio non è una probabilità calibrata; non stimare certezze e non utilizzare dati futuri rispetto al calcio d'inizio.

## Aggiornamento 19/10/2026 — rendimento relativo al ruolo e forma ponderata

- **Fuori ruolo:** il coefficiente di affinità impostato dallo staff e la distanza dal ruolo naturale generano una penalità di rendimento atteso limitata a 1,05 punti. Non modificare mai la **media storica osservata**: la penalità agisce solo sulla previsione.
- **Forma recente:** usare fino a cinque partite precedenti al kickoff con voti disponibili; pesare la deviazione dalla media personale per recenza e pertinenza del rango avversario nel pronostico, con shrinkage quando il campione è scarso (correzione massima ±0,65).
- **Spostamenti ridotti:** penalizzare la distanza fra ruolo naturale e slot sia nella scelta titolare sia nel confronto fra moduli. Se un adattamento è necessario, scegliere la minore perdita attesa fra i giocatori compatibili.
- Dati mancanti: affinità non compilata e assenza di voti non diventano valori osservati fittizi; la correzione forma è nulla senza valutazioni reali.
- DA VALIDARE: il peso delle penalità è un'euristica, non una regressione ricavata da prestazioni misurate nello stesso ruolo.

## Aggiornamento — ricerca globale delle combinazioni

- Sostituito l'algoritmo *greedy* (assegnazione slot per slot) con un assegnatore globale esatto a programmazione dinamica su maschere di 11 slot. Per ogni modulo considera tutte le associazioni ammissibili senza duplicati e massimizza la somma dei punteggi individuali (affinità, rendimento atteso, disponibilità, esperienza, rango avversario, forma, turnover e penalità fuori ruolo).
- La procedura visita soltanto gli stati necessari (massimo 2^11 maschere, per ciascun giocatore), non materializza il fattoriale delle permutazioni. La formazione è calcolabile in browser mobile.
- Dopo l'ottimo globale del punteggio individuale, brevi raffinamenti con scambi tra titolari e sostituzioni dalla panchina valutano la sinergia osservata fra coppie di compagni. **La ricerca è esatta per la parte additiva, ma non garantisce l'ottimo globale quando si considerano tutte le sinergie fra coppie.**
- Conservati i tre moduli migliori già previsti dalla UI. Evitare la scelta anticipata di un esterno quando potrebbe produrre maggiore valore complessivo da attaccante.
- Test regressione specifico: comparazione di Grisolia punta + Zanetti esterno vs disposizione inversa usando una matrice di punteggi esemplificativa (non un risultato reale predetto).

## Aggiornamento 19/10/2026 — nove proposte (3 moduli × 3 XI)

- Scegliere i tre moduli migliori, poi calcolare **tre assegnazioni distinte** per ciascuno. La prima è l'ottimo additivo globale; le altre vengono simulate escludendo progressivamente un singolo abbinamento giocatore/slot dalla prima proposta, limitando i tentativi per contenere il tempo in browser.
- Presentare nove proposte navigabili per modulo e variante, oltre al precedente scorrimento orizzontale e alle frecce.
- L'indice di **fattibilità** è una valutazione euristica 0–100 ottenuta da copertura dei ruoli, completezza dell'XI, copertura dei dati e differenza rispetto al miglior punteggio del gruppo. Non è la probabilità che il mister adotti lo schieramento, né la probabilità di vincere; i valori non devono sommare 100%.
- Se mancano giocatori sufficienti a realizzare varianti distinte, segnalarlo esplicitamente e non inventare titolari.
- Verificare anche le prestazioni con rosa ampia, vista la precedente regressione di blocco dell'Overview.
