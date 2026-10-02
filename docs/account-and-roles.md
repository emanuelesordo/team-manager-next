# Account, ruoli e recupero credenziali

- **Lettura**: `profiles` (solo utente e admin), `app_user_roles`, `players` e `tm_password_reset_requests` per gli amministratori.
- **Profilo**: RPC `tm_app_update_profile` (solo utente autenticato attivo). Password: Edge Function già presente `tm-password-change` con token utente. Nuovo utente o reset dell'admin impongono `must_change_password=true`.
- **Recupero**: Edge Function `tm-password-request` senza login; messaggio generico per evitare enumerazione. L'admin vede soltanto le richieste pendenti e usa la funzione preesistente `tm-password-admin` per approvare o rifiutare. Password temporanea mostrata solo alla risposta del backend e non persistita nel frontend.
- **Amministrazione**: `tm_app_manage_account` aggiorna ruolo, associazione univoca al giocatore e stato attivo in una transazione. Non permette di lasciare il sistema senza amministratori. Controlla squadra e vincolo UNIQUE sul giocatore.
- **Autorizzazione**: `private.is_staff()` e `private.is_admin()` richiedono adesso profilo *attivo* oltre al ruolo. RLS del database resta in vigore.
- **Creazione nuovi account**: il vecchio flusso generalista `admin-create-user` usa il modello team_members/permissions diverso da app_user_roles. Non è esposto come se fosse transazionale con l'app: richiede una Edge Function dedicata e collaudo con credenziali admin. Non creare un utente incoerente tra i due sistemi.
