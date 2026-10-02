# Riconciliazione fixture ↔ tabellini — 02/10/2026

- Modello ufficiale: `app_competition_fixtures`; modello operativo: `app_matches` con FK facoltativa `fixture_id` e indice unico filtrato.
- Audit iniziale: 12 tabellini, **nessuno** con `fixture_id` compilato.
- Con la migrazione `tm_next_reconcile_unique_scheduled_app_matches` sono stati collegati 11 tabellini in stato **scheduled**. Requisiti di sicurezza: stessa stagione, competizione, giornata, identico timestamp UTC, squadra principale dal lato corretto, avversaria censita riconducibile univocamente per nome, assenza risultati ufficiali e stato non iniziato; 1 match ↔ 1 fixture.
- Rimane **1 tabellino non collegato**: la gara conclusa della prima giornata contro Voltesea. Il tabellino operativo registra 0–0, la fixture ufficiale registra 1–4. Non è stato forzato il collegamento e non sono stati sostituiti i punteggi né approvati automaticamente eventi ancora pendenti.
- `tm_app_ensure_match` è stato rafforzato: per una gara già live/finished senza collegamento non crea un nuovo record operativo, per evitare doppioni o risultati incompatibili. Sul frontend il controllo staff impedisce «Apri gestione» di quelle fixture finché il conflitto non viene risolto.
- È richiesta una verifica umana della prima gara e degli eventi proposti: il solo punteggio finale non basta a provare la congruenza dei vecchi tabellini. **Non inventare marcatori o rettifiche.**
- Per i collegamenti programmati è mantenuto lo storico degli ID già esistenti; nessun evento, voto o partecipazione viene eliminato.
