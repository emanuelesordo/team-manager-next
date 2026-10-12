# Team Profile e confidenza delle metriche

> Stato: implementato dal 13-10-2026.

**Sorgenti:** `fresh/team-profile.js`, `fresh/game-state.js`, `fresh/analytics.js`, `fresh/pre-match-prediction.js`.

## Obiettivo

Creare un profilo unico e riutilizzabile della squadra che resti utile anche con pochi eventi ufficiali. Il profilo non è una nuova fonte di verità separata: organizza e normalizza le feature già disponibili e assegna loro una confidenza.

## Livelli di confidenza

### A — risultati e calendario
Disponibili anche senza eventi:
- forma recente ponderata;
- produzione offensiva;
- tenuta difensiva;
- clean sheet;
- continuità nel segnare / fail to score;
- propensione a gare aperte;
- frequenza di gare decise entro un gol;
- vittorie larghe;
- sconfitte larghe;
- volatilità del margine;
- adattabilità casa/trasferta.

### B — timeline gol completa
Usate solo quando la sequenza dei gol è completa e riconcilia il risultato:
- tenuta del vantaggio;
- recupero dallo svantaggio;
- capacità di pareggiare;
- capacità di accorciare;
- protezione dei vantaggi larghi;
- tempo in vantaggio / parità / svantaggio.

### C — eventi specifici
Segnali esplorativi e attenuati:
- risposta entro 10 minuti dopo aver subito;
- vulnerabilità entro 10 minuti dopo aver segnato;
- disciplina;
- superiorità/inferiorità numerica;
- altri pattern evento con campione ridotto.

## Ponderazione

Il profilo usa una scala normalizzata 0–1. Le feature A hanno peso pieno; B e C hanno peso inferiore e vengono ulteriormente attenuate dalla dimensione del campione.

Una metrica con campione nullo non viene interpretata come 0: viene considerata non disponibile.

## Uso

### Numeri
Mostra:
- livello di confidenza A/B/C;
- copertura delle timeline;
- indicatori più caratterizzanti;
- punti forti/deboli solo quando si discostano abbastanza dal neutro.

### Prepartita e pronostico
Il Team Profile viene restituito dal modello insieme agli altri output. Non viene sommato come un secondo correttivo agli stessi dati, per evitare doppio conteggio. Le singole feature continuano a influire nei loro blocchi originali, ma il profilo:
- rende visibile la qualità del segnale;
- permette di selezionare i punti di attenzione;
- prepara una fonte comune per presentazioni e narrativa.

## Regola di sviluppo

Ogni nuova metrica deve dichiarare:
1. sorgente dati;
2. livello A/B/C;
3. campione minimo;
4. comportamento con campione insufficiente;
5. eventuale uso nel pronostico;
6. test automatico.
