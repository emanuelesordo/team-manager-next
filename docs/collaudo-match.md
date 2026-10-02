# Collaudo Match Center, 2 ottobre 2026

## Verifiche automatiche aggiunte
- `tests/match-route.test.mjs`: la fixture UUID è presente nel deep link e viene recuperata al refresh; gli hash malformati sono rifiutati.
- `tests/match-data.integration.test.mjs`: mock delle API Supabase; esegue login, verifica il ruolo admin, carica stagione e fixture, risolve il tabellino per `fixture_id`, legge 21 giocatori e 16 eventi, ripete la lettura per simulare un nuovo caricamento, e fa logout. Verifica la presenza del bearer sulle richieste protette.
- Il test di integrazione utilizza esclusivamente risposte simulate: non dimostra che un vero account Supabase possa eseguire le operazioni o che l'interfaccia sia corretta su un browser mobile.
- La verifica reale della partita Voltesea–Calcio Caselle conferma 21 righe giocatori e 16 eventi associati alla stessa fixture.

## Funzione migliorata
Il Match Center usa ora un percorso `#match/<fixture_uuid>`. Dopo un aggiornamento del browser, l'app risolve la fixture e ricarica le tabelle operative invece di tornare alla Home.

## Collaudo autenticato da completare
Occorre una sessione admin reale su browser: effettuare login, aprire Voltesea–Caselle, consultare Formazioni ed Eventi, ricaricare la pagina, verificare che gli stessi dati siano presenti, uscire e accedere nuovamente. Verificare sia desktop sia mobile e la visualizzazione delle proposte ancora da validare. Non utilizzare credenziali di un vero account nei test versionati.
