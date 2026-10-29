# Analista AI — generazione su cambiamenti sportivi

## Flusso

Il Match Center mostra **Analisi AI salvata**. L'apertura del sito legge una cache condivisa in Supabase senza ricontattare Gemini quando le fonti sono invariate.

La fonte viene identificata da un'impronta dei seguenti dati, e soltanto loro:
- Risultati delle fixture **finite** della competizione.
- Eventi con stato **official** associati alle partite finite (tipo, minuto e squadra), non le proposte o le contestazioni.
- Data di pubblicazione delle **convocazioni ufficiali**, generata dopo l'importazione massiva da messaggio e la verifica del salvataggio.

La disponibilità modificata individualmente, il cambio manuale del carosello formazione e il refresh della pagina **non** invalidano l'analisi.

Quando una fonte confermata cambia, l'analisi viene rigenerata alla prima apertura del prepartita interessato e poi salvata. Questo è un refresh *lazy*: la conferma non esegue una chiamata AI in background per ogni match futuro.

## Dati e privacy

Il modello riceve i gol attesi e gli esiti del motore statistico, le informazioni aggregate dalle timeline e i rating/ruoli della formazione ipotetica. I nomi dei giocatori vengono esclusi dal payload verso Gemini.

Le probabilità 1/X/2 e i punteggi esatti non sono sostituiti dal linguaggio naturale. Il servizio AI non può modificare Supabase o la formazione.

Il piano Free del provider può usare dati forniti per migliorare i servizi: **non inviare dati personali sensibili**. La chiave del modello non è presente nel frontend GitHub Pages.

## Attivazione

1. Generare una chiave gratuita Gemini API su https://aistudio.google.com/apikey, secondo le condizioni e le quote correnti.
2. Configurarla come secret **GEMINI_API_KEY** in Supabase, progetto `team-manager`, Edge Functions > Secrets.
3. Accedere come membro dello staff e aprire una partita futura. La prima analisi viene generata una sola volta in presenza della chiave.

In assenza di chiave, il motore statistico continua a funzionare. La cache degli errori lato browser blocca i tentativi ripetuti per un'ora per la stessa versione dei dati.

## Architettura

- `fresh/main.js`: impronta delle fonti confermate, cache frontend e resa report.
- `fresh/api.js`: lettura/generazione autenticata e pubblicazione ufficiale delle convocazioni.
- `fresh/callup-import-ui.js`: pubblicazione del marcatore **solo** dopo l'importazione verificata.
- `tm_ai_prediction_cache`: report condivisi per fixture, con RLS in sola lettura per utenti autenticati.
- `tm_ai_callup_publications`: pubblicazione della lista ufficiale, con autorizzazione per membri della squadra.
- Supabase Edge Function `tm-ai-analyst`: controlla JWT, appartenenza allo staff per rigenerare, fingerprint e quota del provider.

Non è una chat libera in tempo reale: genera un rapporto persistente quando cambiano le fonti confermate. La richiesta è elaborata quando si apre il Match Center, non tramite cron in background.

## Verifiche

Controllare: una singola generazione alla prima apertura, nessuna generazione al refresh, nuova generazione dopo un risultato concluso, dopo conferma evento in partita terminata e dopo importazione ufficiale convocazioni. Validare i permessi e le quote con account staff e fan.