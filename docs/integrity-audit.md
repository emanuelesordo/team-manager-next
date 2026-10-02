# Controllo integrità

Supabase: funzione `tm_app_integrity_report()` già distribuita, sola lettura, accessibile unicamente a ruoli staff autenticati. Controlla match non collegati, fixture non esistenti, season/competition incoerenti, risultati discrepanti (se valorizzati in entrambe le fonti), convocazioni/eventi orfani. Restituisce contatori per tipologia, massimo 100 righe dettagliate e timestamp. Non ripara né altera dati.

Frontend: Amministrazione → Integrità → Esegui controllo. Non mostra dati diagnostici senza attivazione esplicita dell'utente. Il caricamento del tabellino ora segnala le richieste fallite.

Nel controllo preliminare: zero tabellini scollegati, zero fixture inesistenti, zero convocazioni ed eventi orfani. La partita Voltesea–Caselle conserva punteggi discordanti fino a revisione dei dati.
