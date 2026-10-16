# Ruoli naturali e affinità dei giocatori

## Origine e semantica
- Il catalogo è `public.football_positions` (19 posizioni attive, inclusi QD/QS).
- Il profilo ufficiale è `public.app_player_role_affinities`: una riga per giocatore/posizione, affinità intera 1–100, ruolo naturale unico al 100%.
- Le percentuali vengono impostate manualmente da admin/manager. Non sono calcoli statistici derivati, non sono fondate su voti ed eventi, e non vengono precompilate in automatico.
- `position_affinity_evaluations` e `position_affinity_submissions` restano separati: sono valutazioni raccolte dagli utenti e **non** sono la fonte ufficiale della heatmap.
- L'assenza di profilo/percentuale è `N/D`, non 0% né una percentuale dedotta.

## Interfaccia
- In **Amministrazione → Rosa**, seleziona il giocatore, il ruolo naturale e le percentuali secondarie. Una percentuale vuota significa ruolo non configurato. Il salvataggio avviene con il form del giocatore.
- In **Rosa → Scheda giocatore → Ruoli** viene mostrata una heatmap su mezzo campo (attaccanti in alto, portiere in basso) con intensità proporzionale alla percentuale e lista testuale ordinata.
- Le fasce di affinità visualizzate sono 85–100, 70–84, 50–69, 1–49%; valori non configurati non compaiono.
- Quando si seleziona il naturale, la macro-categoria `generic_role_manual` esistente viene aggiornata a P/D/C/A per coerenza con la rosa e con gli attuali algoritmi basati sulla categoria generale.
- **Non viene mostrato alcun badge nella scelta del giocatore in Formazione.** Il modello dei voti attesi e dell'ipotetica non applica automaticamente correttivi numerici sulle nuove percentuali: eventuale uso algoritmico specifico richiede un criterio documentato e testato per non introdurre coefficienti arbitrari.

## Persistenza, sicurezza e verifiche
- Migrazione: `supabase/migrations/20261016_tm_player_role_affinity_profiles.sql`.
- Salvataggio atomico delle affinità con `tm_app_save_player_roles(season_id,player_id,roles)` che valida catalogo, duplicati, una sola posizione naturale e permessi staff/squadra.
- RLS: lettura per anon e autenticati, scrittura solo tramite RPC controllata (revocate le scritture dirette).
- I ruoli vengono caricati nella richiesta di stagione di `fresh/api.js`, non replicati nelle statistiche SQL della stagione.
- Test frontend: `tests/player-role-heatmap.test.mjs`. Confermare inoltre la resa visiva autenticata su mobile e desktop.
