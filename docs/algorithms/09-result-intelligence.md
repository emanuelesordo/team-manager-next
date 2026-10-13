# Analisi dei risultati e rendimento contestuale

> Stato: implementato dal 13-10-2026. Specifica descrittiva: la logica effettiva resta nei file JS e nei test.

**Sorgenti:** `fresh/result-intelligence.js`, `fresh/team-profile.js`, `fresh/game-state.js`, `fresh/analytics.js`, `fresh/analytics-ui.js`, `fresh/pre-match-prediction.js`.
**Test:** `tests/result-intelligence.test.mjs`, `tests/game-state.test.mjs`, `tests/analytics.test.mjs`, `tests/prematch-prediction.test.mjs`.

## Disponibile senza eventi — classe A

Le partite conteggiate devono essere concluse, con punteggio valido e non di test.

1. Distribuzione punteggi esatti finali (lato squadra sempre normalizzato): 0–0, 1–0, 0–1, 2–1, ecc.
2. Margini vittorie/sconfitte: 1, 2, 3+; medie e mediane dei margini; varianza di gol fatti, subiti e differenza reti.
3. Percentuali descrittive di entrambe a segno, 0–1 gol totali, esattamente 2, 3+ gol.
4. Clean sheet, fail-to-score, gare chiuse o con molti gol, gare decise entro un gol al 90°/80°: non si tratta di minuti in cui lo scarto è rimasto contenuto.
5. Rendimenti casa/trasferta, per superficie, larghezza e lunghezza del campo: le caratteristiche richiedono un impianto identificabile e configurato.
6. Rendimento per rango stimato dell'avversaria: punti/gara, GF/G, GS/G, DR/G contro rango superiore, simile, inferiore.
7. Forma recente pesata per recenza e corretta quando ci sono almeno due confronti attendibili sul rango.
8. Trend di forza stimata su sequenza cronologica di risultati: indice Elo descrittivo, non rating certificato.

### Rango stimato e leakage

Prima di ogni gara, il valore dell'avversaria usa esclusivamente:
- risultati già disputati prima del relativo kickoff;
- al massimo uno storico precedente alla stagione della gara, se esiste.

Il modello parte da un valore neutro se manca lo storico. Le partite senza un riferimento di forza adeguato finiscono in gruppo *rango incerto*, non vengono forzate nel gruppo simile.

La valutazione è descrittiva e relativa: non va trattata come xG, ranking Opta o probabilità calibrata.

### Risultato reale vs previsione archiviate

La tabella già esistente `app_match_prediction_snapshots` salva modello e `calculated_at`. Il frontend estrae le probabilità 1/X/2 e confronta punti guadagnati e punti attesi:

`punti_attesi = P(vittoria) × punti_vittoria + P(pareggio) × punti_pareggio + P(sconfitta) × punti_sconfitta`

Conta **solo** snapshot con `calculated_at` strettamente anteriore al `kickoff_at` della partita analizzata. Una previsione calcolata successivamente viene esclusa anche se dichiara di essere una previsione prepartita. In assenza di snapshot valido la metrica è **non disponibile**.

Lo scostamento è descrittivo; richiede molte partite per suggerire sistematiche sovra/sottoperformance e non misura di per sé accuratezza/calibrazione delle probabilità.

## Solo timeline gol completa — classe B

- Primo gol segnato/subito e risultato finale, conversione in vittorie/sconfitte, punti persi dopo 1–0, punti recuperati dopo 0–1.
- Progressione esplicita dei parziali da lato squadra; goal opener, equalizer, deficit reduction, lead extension, go-ahead.
- Tempo esatto osservabile in vantaggio, pareggio, svantaggio.
- Frequenza di partite **sempre** entro una rete, disponibile solo dopo aver verificato tutti i gol e il parziale finale.
- Vantaggi persi e recuperi, trasformazione vantaggio minimo in doppio, avversaria che accorcia.

Per partite con solo intervallo e risultato finale: si misura lo **stato all'intervallo** e l'esito conclusivo. Non viene stimato falsamente il tempo trascorso in ogni stato.

## Eventi specifici / campioni piccoli — classe C

- Risposte entro 5 e 10 minuti dopo la rete avversaria.
- Gol subiti entro 5/10 minuti da una propria marcatura.
- Espulsioni proprie e avversarie tenute separate.
- Superiorità/inferiorità numerica solo se minuti ed eventi di entrata/uscita sono riconciliati.

Non interpretare questi segnali come effetto causale del gol o dell'espulsione. Mostrare sempre copertura campionaria.

## Applicazione al pronostico

Le analisi A entrano nei profili di entrambe le squadre. Forma corretta per rango ha un piccolo correttivo contestuale con almeno due partite attendibili; gli altri segnali vengono utilizzati nella selezione dei fattori, confronti e narrativa senza duplicarli indiscriminatamente nelle lambda.

L'analisi di tutte le gare usate per pronosticare una fixture si ferma *prima del suo kickoff*. Non è lecito usare un risultato dopo la gara target per calcolare forza dell'avversaria o forma storica.
