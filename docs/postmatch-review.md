# Revisione postpartita — 2 ottobre 2026

Fonte: `docs/specification-original.txt`, sezioni Match Center, eventi, eleggibilità, risultati e validazione. Non si inventano marcatori, minuti o eventi.

## Confermato nel codice e nel database
- La conclusione della partita (`app_matches.status='finished'`) non equivale alla conferma del risultato (`result_review_status='provisional'|'confirmed'`). Una gara storica conclusa parte come `provisional`.
- `tm_app_review_result` riservata allo staff: `confirm` richiede partita/fixture concluse, punteggi operativi allineati al calendario ufficiale e assenza di eventi proposti/contestati/confermati dalla community in attesa; `reopen` revoca la validazione, `align_operational` copia **solo su conferma esplicita** il risultato ufficiale nel tabellino.
- I trigger SQL annullano la conferma quando cambiano risultati, stato o eventi. Non modificano retroattivamente l'esito storico se non richiesto.
- Gli allineamenti sono registrati in `tm_app_result_reconciliations` (valori precedenti/nuovi, fixture, staff e timestamp) e sono consultabili nell'interfaccia dallo staff.
- `tm_app_amend_event` rettifica i singoli eventi conservando l'ID e un audit append-only `tm_app_event_revisions` (versione precedente e nuova, motivo obbligatorio, staff, data). La rettifica riporta l'evento allo stato `proposed` per nuova validazione.
- Le revisioni normali continuano a usare `tm_app_review_event`: approvazione esplicita o scarto logico senza DELETE. La rettifica non può cambiare tipo/squadra di un gol già conteggiato nel punteggio.
- Tutte le RPC controllano `auth.uid()`, `private.is_staff()`, partita collegata e stato. I registri hanno RLS: sola lettura staff, scrittura soltanto tramite funzioni SECURITY DEFINER.
- Il frontend include i pulsanti in Match Center → Gestione → Eventi, l'editor motivato e gli storici; il comando live si chiama «Termina partita», non «Termina e ufficializza».

## Verifiche
La pipeline Node/build e il browser mock desktop/mobile sono stati superati sul commit di sviluppo. La simulazione utilizza dati e credenziali fittizi, quindi **non è un collaudo autenticato su Supabase con un dispositivo reale**. È verificato in produzione che Voltesea–Caselle conserva i suoi 16 eventi `proposed`, il risultato ufficiale 1–4 e il tabellino operativo 0–0, senza approvazioni o allineamenti forzati.

## Pendenze indipendenti
La roadmap generale contiene altre funzioni di progetto e collaudi non coperti da questa milestone (moduli PRO, attributi ruolo/comfort, fasi/gironi avanzati, test autenticato reale e dispositivi fisici). Non considerarli completati per deduzione.

## Aggiornamento architetturale del 02/10/2026 (prevalente)
La precedente discrepanza dei due punteggi è stata risolta architetturalmente: **`app_competition_fixtures` è l'unica fonte del risultato**, mentre i punteggi in `app_matches` sono proiezioni sincronizzate e non un secondo tabellino. Voltesea–Caselle mostra ora 1–4 in entrambe le strutture per compatibilità, ma conserva 16 eventi `proposed` e `result_review_status='provisional'`. Le eventuali descrizioni precedenti riferite al vecchio 0–0 sono quindi storiche. Gli eventi attivi delle fixture e dei match sono unificati in **`app_match_events`**; il precedente `app_fixture_events` è ora una vista in lettura, con archivio storico conservato. Specifica vincolante: [`architecture-single-event-result.md`](./architecture-single-event-result.md).
