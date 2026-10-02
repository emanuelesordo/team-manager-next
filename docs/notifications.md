# Notifiche personalizzate

- Fonte: `team_notifications` del modello di piattaforma generale.
- Query limitata a `recipient_profile_id=auth.uid()` e `team_id` della squadra: RLS impone la stessa proprietà. Non sono pubbliche.
- Il badge conta i messaggi non letti. Cache di un minuto e aggiornamento all'apertura.
- L'utente può segnare la propria notifica come letta con PATCH condizionata per ID e destinatario, sotto RLS server.
- Nessuna notifica viene inventata nel browser: i produttori server-side restano espliciti e separati.
