# Riconciliazione fixture ↔ tabellini — 02/10/2026

- Modello ufficiale: `app_competition_fixtures`; modello operativo: `app_matches` con FK facoltativa `fixture_id` e indice unico filtrato.
- Audit iniziale: 12 tabellini, **nessuno** con `fixture_id` compilato.
- Con la migrazione `tm_next_reconcile_unique_scheduled_app_matches` sono stati collegati 11 tabellini in stato **scheduled**. Requisiti di sicurezza: stessa stagione, competizione, giornata, identico timestamp UTC, squadra principale dal lato corretto, avversaria censita riconducibile univocamente per nome, assenza risultati ufficiali e stato non iniziato; 1 match ↔ 1 fixture.
- **Aggiornamento successivo:** anche il tabellino Voltesea–Calcio Caselle è stato collegato alla fixture corretta dopo verifica univoca di stagione, competizione, data/ora e squadre. Il collegamento è ripristinato, ma i punteggi restano intenzionalmente 0–0 (tabellino) e 1–4 (fixture ufficiale). Nessun evento storico è stato approvato automaticamente. L'allineamento ora è disponibile soltanto su conferma esplicita dello staff, con storico append-only.
- `tm_app_ensure_match` è stato rafforzato: per una gara già live/finished senza collegamento non crea un nuovo record operativo, per evitare doppioni o risultati incompatibili. Sul frontend il controllo staff impedisce «Apri gestione» di quelle fixture finché il conflitto non viene risolto.
- È richiesta una verifica umana della prima gara e degli eventi proposti: il solo punteggio finale non basta a provare la congruenza dei vecchi tabellini. **Non inventare marcatori o rettifiche.**
- Per i collegamenti programmati è mantenuto lo storico degli ID già esistenti; nessun evento, voto o partecipazione viene eliminato.

## Stato attuale 02/10/2026 — fonte unica
Per tutte le fixture con risultato valorizzato, il punteggio compatibile dei tabellini collegati viene sincronizzato da `app_competition_fixtures`, senza doppio valore autorevole. La precedente differenza Voltesea–Caselle è stata riallineata al risultato 1–4 nel campo di compatibilità; la validazione degli eventi è rimasta separata e non è stata modificata. Tutti gli eventi sono letti da `app_match_events` (fixture_id sempre presente; match_id opzionale). Per il contratto e l'archivio storico, vedere `docs/architecture-single-event-result.md`.
