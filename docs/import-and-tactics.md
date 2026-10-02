# Importazione e campo tattico

L'amministrazione include un tab «Importa CSV», separato dall'editor singole fixture. Il file accetta separatore punto e virgola, virgola o tab, colonne `giornata;data;ora;casa;ospite;campo;indirizzo`, date italiane convertite in Europe/Rome (anomalie DST segnalate) oppure `kickoff_at` ISO con offset esplicito.

`fresh/import-domain.js` gestisce parsing e validazione senza rete. `fresh/calendar-import.js` mostra file e prime righe; una prima chiamata `tm_app_import_fixtures` in modalità dry-run verifica il conteggio dal database. Solo dopo conferma esplicita si esegue la transazione server che inserisce le fixture mancanti (max 250), ignora i duplicati e non modifica risultati, eventi e match operativi.

Il campo tattico è gestito da `fresh/lineup-pitch.js`: undici posizioni numerate, disposte secondo il modulo se valido, fallback grafico 4-4-2. Da mobile selezione tramite tocco del nome, quindi dello slot; da desktop anche drag-and-drop. Occupante di uno slot già assegnato viene scambiato col precedente slot o torna in panchina. La UI non salva alcun dato autonomamente: il pulsante Salva convocazioni invoca la RPC `tm_app_save_lineup`, che applica vincoli e autorizzazioni.

La migrazione SQL `tm_next_atomic_fixture_csv_import` è applicata su Supabase e documentata nella specifica. Rimangono da collaudare navigazione e interazione da sessioni reali mobile e desktop.
