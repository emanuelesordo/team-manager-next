# Configurazione e collegamenti

- `app_competitions` è la fonte per formato, categoria, durata, supplementari, rigori, playoff, playout, punteggio e disciplina. I valori JSON esistenti sono conservati, cambiando solamente le chiavi esplicitamente fornite.
- `app_competition_opponents` collega molte-a-molte avversarie e competizioni. RPC `tm_app_add_competition_opponents` applica solo inserimenti nuovi con `ON CONFLICT DO NOTHING`, controllando ruolo attivo ed esistenza degli ID.
- **Calendario singolo**: `tm_app_import_fixtures` è riutilizzata per una nuova fixture senza introdurre un secondo motore di inserimento. Un tentativo duplicato non modifica dati esistenti. L'ora inserita è interpretata in `Europe/Rome`, compresi controlli DST.
- `tm_app_edit_fixture` per la modifica di orari/campi delle fixture programmate; una partita in corso o terminata si gestisce dalla console del Match Center.
- Non cancellare relazioni storico/risultati semplicemente rimuovendo checkboxes. L'editor delle fasi `phase_rules` necessita di validazione dedicata rispetto al regolamento della competizione.
