# Operazioni amministrative, convocazioni e live

## Componenti

- `fresh/staff-ui.js`: forms di amministrazione, convocazioni, console di gara, validazione eventi, controllo orologio e rientri blu.
- `fresh/staff.css`: layout desktop, pannelli e composizione mobile dedicata.
- `fresh/api.js`: accesso REST/RPC con sessione Supabase e publishable key.
- `fresh/main.js`: instradamento area Admin e scheda Gestione del Match Center.
- `tm_app_*` (SQL Supabase): RPC con ruolo staff verificato server-side e operazioni atomiche.

## Amministrazione

Accesso per ruolo `admin` o `manager`: squadra, stagioni, competizioni e regole, avversarie, giocatori/rosa stagionale, calendario, infortuni e squalifiche. La sezione Utenti è riservata agli admin: elenco e richieste password pending con approvazione/rifiuto tramite Edge Function esistente `tm-password-admin`. Il server genera una password temporanea mostrata una sola volta e impone cambio all'accesso successivo.

Modifiche allo storico vietate se incompatibili. Nessun pulsante elimina fisicamente gli oggetti sportivi. Creazione di una nuova stagione non cambia automaticamente quella attiva; il passaggio esplicito è transazionale.

## Prepartita

Per ogni fixture della squadra, «Gestione» associa un solo tabellino `app_matches`. L'identità è salvata come `fixture_id` univoco; eventuali tabellini precedenti vengono riutilizzati solo se la corrispondenza è non ambigua.

Convocazioni e formazione iniziale: ruoli starter, bench, available, absent; numero maglia storico, slot da 1 a 11, capitano titolare, indisponibilità; limite di 11 titolari; squalifiche attive impediscono la convocazione. Infortuni vengono segnalati ma non impediscono automaticamente la convocazione. Aggiornamento massivo atomico con `tm_app_save_lineup`, solo prima dell'inizio.

## LIVE

`tm_app_match_action` governa: start, pause, resume, period/halftime, second_half, extra, score, event, void_event, approve_event, finish, reopen.

- L'avvio fuori dalla finestra -30 minuti / +4 ore richiede esplicita conferma forzata.
- Orologio registrato in Supabase e calcolato localmente; intervallo con cronometro fermo.
- Eventi: gol, autogol, rigori, assist associato al gol, ammonizioni, espulsioni, blu/rientri, sostituzioni con uscente obbligatorio ed entrante facoltativo, fine periodo e altro.
- Minuto facoltativo (NULL se ignoto); recupero distinto; in UI il minuto del secondo tempo viene convertito in minuto assoluto utilizzando la durata configurata.
- Eleggibilità con timeline di ingresso/uscita, rossi e blu; senza inventare minuto se assente.
- Doppia origine risultato: la fixture è fonte ufficiale. Eventi gol possono aggiornare il punteggio nella stessa transazione; si può inserire un risultato senza marcatore noto. La cancellazione è logica e rettifica in modo atomico il punteggio solo per i gol collegati.
- Validazione staff delle proposte; finale impedito con proposte o contestazioni ancora aperte.
- Cartellini blu: ritorno automatico, durante live visibile, soltanto se configurata `discipline_rules.blue_duration_minutes`, con chiave idempotente.

## Due modelli delle stagioni e competizioni

`app_seasons/app_competitions` e `seasons/competitions` restano famiglie diverse. Per infortuni e squalifiche, la stagione generale è identificata solo se squadra e nome coincidono e le date si sovrappongono per almeno 180 giorni; esito non univoco = nessuna scrittura.

`tm_app_competition_links` definisce esplicitamente la relazione tra competizione applicativa e generale. Configurazione dalla scheda Competizioni; verificata server-side sullo stesso team e periodo. In mancanza di collegamento il blocco squalifiche attive è intenzionalmente prudenziale. Nessuna fusione o cancellazione delle strutture esistenti.

## Test e limiti

Eseguiti in Supabase e annullati con `ROLLBACK`: collegamento match senza duplicazioni; formazione con titolari e panchina; gol; sostituzione; blu/rientro e deduplica; evento senza minuto; periodi; rettifica punteggio; approvazione proposta; finalizzazione; creazione anagrafica/rosa; calendario; ponte competizioni, inclusi periodi stagione non perfettamente coincidenti. Il workflow GitHub esegue lint sintattico, test JavaScript e build Pages.

La pipeline automatica **non** sostituisce il collaudo manuale con credenziali staff reali da smartphone e browser. Le Edge Functions del modello `matches` generale NON vengono mescolate con quelle del modello `app_matches`. Restano fuori da questo ciclo l'import massivo, l'editor tattico drag-and-drop, la gestione completa delle autorizzazioni della piattaforma generale, il calcolo di ogni variante di simulazione e una verifica browser end-to-end autenticata. Queste parti non vanno dichiarate completate.
