# Sicurezza, privacy e permessi

- Il repository sarà pubblico: mai inserire `service_role`, `sb_secret_`, password, JWT personali, backup o dati riservati.
- `src/config.js` contiene solo la chiave Supabase `sb_publishable_`, prevista per l'impiego in browser. **RLS obbligatoria** sui dati accessibili.
- Sono state verificate nell'ambiente Supabase policy RLS sulle tabelle principali. Non è stato modificato il database.
- Accesso tramite Edge Function preesistente `auth-login`, con username/password e successivo uso della sessione Supabase.
- L'utente senza login vede solo ciò che le policy gli consentono: un fallback grafico non cambia i permessi.
- Il controllo `role === 'admin'` nel frontend è solamente estetico, non è un'autorizzazione.
- Nessuna registrazione di eventi o voti, modifica fixture o apertura di dati medici è implementata in questa prima release.
- I dati personali non necessari alle viste (data di nascita, contatti, infortuni con note staff, visite mediche, etc.) non vengono richiesti.
- HTML dinamico: valori DB con escaping prima di inserirli nel markup; URL immagini limitate a HTTP(S).

## Prepubblicazione

Verificare la configurazione origin/CORS delle Edge Functions, Auth Redirect URLs, permessi SELECT anon e gestione delle immagini in Storage; per autenticazione e RLS testare un account admin, un giocatore, un fan e un anonimo. Non presumere che tabelle leggibili da anon debbano contenere ogni colonna sensibile: lo schema deve essere costruito per letture sicure o usare view dedicate.

## Verifica dei permessi sulle colonne

In Supabase è stata verificata la selezione per anon: `players.first_name`, `last_name`, `id`, `photo_url` e `generic_role_manual` sono leggibili; `players.team_id` e `birth_date` **non** sono leggibili da anon. Per rispettare i grant esistenti il frontend pubblico legge soltanto le colonne autorizzate, senza cambiare le policy. La squadra del roster deriva dai riferimenti stagionali.
