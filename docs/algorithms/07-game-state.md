# Game state e contesto dei gol

> Stato: implementato dal 13-10-2026. La logica è condivisa da `Numeri`, analisi prepartita e pronostico.

**Sorgenti:** `fresh/game-state.js`, `fresh/analytics.js`, `fresh/pre-match-prediction.js`.

## Principio

Il minuto medio generico dei gol non viene usato come segnale predittivo. Un gol viene interpretato in base al **parziale precedente**, al lato che segna e alla transizione di stato che produce.

Ogni timeline completa viene normalizzata dal punto di vista della squadra analizzata: `team` e `opponent` restano sempre separati.

## Stati della gara

Per ogni partita si calcola il tempo trascorso:
- in vantaggio;
- in parità;
- in svantaggio.

Da questi valori si ricavano anche le quote percentuali sul tempo totale osservabile.

## Tipologia del gol rispetto al parziale

Ogni rete viene classificata come:
- **apertura**: primo gol sullo 0-0;
- **sorpasso**: gol segnato da situazione di parità dopo che la gara era già stata sbloccata;
- **pareggio**: gol che annulla uno svantaggio;
- **accorciamento**: gol segnato restando ancora in svantaggio;
- **allungo**: gol che aumenta un vantaggio già esistente.

Le stesse categorie vengono conteggiate separatamente per gol fatti e subiti.

## Reazioni e gestione

Sono inoltre registrati:
- vantaggi acquisiti e vantaggi persi;
- svantaggi subiti e svantaggi recuperati;
- primo gol fatto/subito;
- profondità massima dello svantaggio;
- risposta entro 10 minuti dopo un gol avversario;
- gol subito entro 10 minuti dopo una propria rete.

La finestra di 10 minuti è configurata nel motore e potrà essere affiancata da 5 minuti se il campione crescerà.

## Attendibilità

Le metriche di game state vengono calcolate solo quando:
1. la partita è conclusa;
2. la sequenza dei gol è completa;
3. i gol riconciliano il risultato ufficiale;
4. i gol hanno un minuto utilizzabile;
5. gli eventi rifiutati sono esclusi.

Timeline incomplete non devono produrre inferenze sul parziale.

## Uso nei moduli

### Numeri
Mostra stato della gara, gol per contesto del parziale, gol fatti/subiti nei tre stati e reazioni rapide.

### Analisi prepartita
Genera punti di attenzione come:
- capacità di pareggiare dopo essere andati sotto;
- vulnerabilità nel mantenere un vantaggio;
- frequenza di accorciamenti;
- risposta rapida dopo aver subito;
- vulnerabilità subito dopo aver segnato.

### Pronostico
Il precedente correttivo basato sulla coincidenza dei minuti medi è sostituito da un **pattern sul parziale**. Il segnale confronta capacità di reazione della squadra con la vulnerabilità corrispondente dell'avversaria, con attenuazione per piccoli campioni.

## Evoluzioni previste

Quando il campione sarà sufficiente, aggiungere:
- distribuzione delle categorie per finestre temporali;
- separazione 5' / 10' della risposta immediata;
- stato gara con superiorità/inferiorità numerica;
- rendimento per profondità dello svantaggio (-1, -2, -3+);
- punti guadagnati da posizione di svantaggio e persi da posizione di vantaggio;
- hazard di segnare/subire nei minuti successivi a un cambio di stato.
