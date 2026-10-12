# Verifica congruenza e regressione

> Stato: ricognizione del codice su branch main (12-10-2026). Le descrizioni "ATTUALE" derivano dai sorgenti; "DA VALIDARE" indica requisiti o criticità, non funzionalità garantite. Modificare il codice e i test per cambiare l'app: questo Markdown non viene eseguito.

## Verifiche minime per ogni modifica
1. Ricontrollare sorgente GitHub aggiornato, funzione modificata e documentazione.
2. Controllare compatibilità fra firma del pronostico, output utilizzati da UI e formazione ipotetica.
3. Eseguire `npm run check` (secondo README: sintassi, test e build); in caso di errore riportare log e non dichiarare successo.
4. Testare almeno: prima giornata/storico presente; prima giornata/storico assente; poche gare; fixture cancellata; confronto tra ranghi; eventi senza minuto; voti mancanti; indisponibile; 11 titolari non duplicati; pronostico retrospettivo senza dati futuri.
5. Dopo commit su `main`, verificare GitHub Actions `pages.yml` e pagina pubblicata. Una push riuscita NON prova deployment riuscito.

## Controlli probabilistici
Probabilità fra 0 e 1; somma 1/X/2 approssimativamente 1; migliori tre score esatti in ordine decrescente; output coerente con input; nessuna probabilità interpretata come certezza.

## Criteri di accettazione
- Nessun dato reale modificato solo per collaudo.
- Nessuna regressione desktop/mobile.
- Test automatici superati e verifica effettiva del rendering, ove possibile.
- Eventuali limiti e difetti residui elencati in modo esplicito.

## Registro anomalie note da verificare
- Mancata visualizzazione voti della formazione ipotetica riportata dall'utente.
- Ripetitività della narrativa prepartita.
- Verificare la qualità della ponderazione storica nelle primissime gare.
