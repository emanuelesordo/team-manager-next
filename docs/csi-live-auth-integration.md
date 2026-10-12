# Integrazione CSI Live autenticata (personale)

## Stato verificato (12 ottobre 2026)
- Progetto Supabase: `team-manager` (`qxblxomcpepwavgvhtuk`).
- `csi-match-import` riceve JSON strutturato da un utente staff, valida fixture, squadra e codice gara e salva snapshot/eventi in revisione.
- `csi-daily-sync` e `csi-match-import-preview` attualmente rispondono 410; non sono sincronizzatori operativi.
- Portale CSI Live: form con codice fiscale/password. Endpoint, handshake, cookies, CSRF, MFA e permessi d'uso da backend **non verificati**.
- Nessuna credenziale CSI è stata acquisita, caricata o incorporata nella repository.

## Preparazione effettuata
- `supabase/functions/csi-live-connection/index.ts` fornisce una diagnostica **solo admin** via GET, con JWT Supabase valido.
- Non esegue login CSI e non dichiara la sincronizzazione attiva.
- Nessun token, password, sessione o CF CSI nei payload, query string, log o repository.

## Integrazione da completare, previa verifica
1. Ottenere dal CSI un metodo di accesso programmabile consentito (preferibile API con token delegato), documentazione endpoint e condizioni di utilizzo.
2. Conservare eventuali credenziali esclusivamente nei Secrets Supabase; non aggiungerle al GitHub pubblico o alla UI; configurare la rotazione e il revoca accesso.
3. Implementare adapter CSI Live con endpoint **fisso/allowlist**, sessione server-side e niente cookie inviati al browser. Vietare URL arbitrarie e redirect fuori dominio.
4. Limitare l'accesso alle funzioni admin o scheduler autenticato; aggiungere timeout, rate limiting/backoff, blocco su MFA/CAPTCHA, log privi di PII e un test con account autorizzato.
5. Mappare la risposta nell'attuale payload di `csi-match-import`; importare come snapshot **pending**, mai sovrascrivere eventi locali automaticamente.
6. Attivare lo scheduler solo dopo test positivi su match di prova e approvazione delle condizioni CSI.

## Richiesta diagnostica
`GET /functions/v1/csi-live-connection` con `Authorization: Bearer <JWT Supabase admin>`.

Risposte: 401 non autenticato, 403 non admin, 503 errore configurazione, 200 stato integrazione (nessun secret restituito).
