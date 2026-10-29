# Analista AI prepartita

L'analista del Match Center usa il pronostico statistico e la formazione ipotetica corrente come fonte dati. Non modifica punteggi, eventi o formazioni, e non sostituisce le probabilita del motore.

## Attivazione del modello gratuito

1. Generare una chiave Gemini API in Google AI Studio (verificare la disponibilita del piano Free e i limiti correnti).
2. Aprire Supabase > progetto team-manager > Edge Functions > Secrets.
3. Inserire un segreto **GEMINI_API_KEY** con il valore della chiave, **mai** nel codice GitHub Pages o in fresh/config.js.
4. Aprire una partita futura nel Match Center, accedere con un account e porre una domanda in **Analista AI**.

La Edge Function 'tm-ai-analyst' richiede JWT valido, applica limiti di dimensione al messaggio e inoltra al provider solo i dati di partita riassunti dall'interfaccia. I limiti di utilizzo del piano Free valgono comunque; per uso intenso aggiungere limiti per utente e logging senza dati personali.

**Privacy:** il piano Free di Gemini puo utilizzare i contenuti inviati per migliorare i prodotti Google. Non includere dati personali, informazioni riservate, telefoni o messaggi privati nel contesto.

Se GEMINI_API_KEY non e presente, la funzione restituisce un errore di configurazione, senza addebiti. Il pronostico statistico rimane utilizzabile.

## Architettura

- `fresh/main.js`: raccolta dati derivati, interfaccia analista e cambio della formazione.
- `fresh/api.js`: chiamata autenticata.
- Supabase Edge Function `tm-ai-analyst`: chiave custodita nel server, regole di analisi e chiamata Gemini.
