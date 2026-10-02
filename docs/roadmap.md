# Roadmap progressiva
## Versione frontend ex novo
- [x] Un solo punto d'ingresso verso `fresh/`; vecchi CSS/JS non caricati.
- [x] Design system desktop stadium-glass con tema ghiaccio opzionale.
- [x] Design smartphone autonomo verde salvia/limone con tab bar e bottom sheet.
- [x] Stagioni e competizioni dal database, niente dati sportivi hardcoded.
- [x] Dashboard, calendario, risultati, classifiche, rosa, giocatore e statistiche.
- [x] Carosello con frecce/pallini, pausa in background e reduced motion.
- [x] Match Center read-only con collegamento esclusivamente univoco a `app_matches`.
- [x] Login username/password tramite Edge Function attiva; refresh e logout.
- [x] Test unitari dei calcoli e workflow di build.
- [ ] Collaudo browser autenticato con accesso reale di amministratore/giocatore.
- [ ] Controllo accessibilità automatico e screenshot su dispositivi fisici.

## Fasi successive
- [ ] Audit completo di PK/FK/trigger/RLS/permessi prima delle scritture.
- [ ] Setup gestione squadra, competizioni, calendario e import.
- [ ] Match Center operativo: convocazioni, moduli, eventi, disciplina, tempi.
- [ ] Valutazioni 1–10 / SV con controllo eleggibilità.
- [ ] Statistiche avanzate e 10.000 simulazioni deterministiche di classifica.
- [ ] Moduli PRO.

Documento prevalente sui requisiti di dominio: `docs/specification-original.txt`.

## Integrità eventi e votazioni — 02/10/2026
- [x] Direzione corretta dell'autogol e suo annullamento in RPC.
- [x] Presenze e eventi statistici limitati alle gare concluse; panchinari mai entrati esclusi.
- [x] Media stagionale = media dei valori medi per partita; SV nullo escluso.
- [x] Tab Voti con selezione 1–10, mezzi punti e SV persistito, accessibile agli utenti autenticati.
- [x] Funzione SQL e RLS restrittive per eleggibilità reale.
- [ ] Collaudo browser autenticato e verifica fisica responsive.

## Import e tattiche — 02/10/2026
- [x] Anteprima CSV e importazione atomica della sola nuova programmazione; niente sovrascrittura dello storico.
- [x] Gestione cambio ora Europe/Rome; formato con timezone ISO supportato.
- [x] Campo tattico interattivo desktop/mobile con drag-and-drop o tocco per assegnazione slot.
- [ ] Test browser autenticati e collaudo import con dati reali.

## Proiezioni — 02/10/2026
- [x] Allineamento vista SQL ufficiale ai punti di ciascuna competizione (non più 3/1 hardcoded).
- [x] Modello Monte Carlo deterministico con 10.000 simulazioni, forme/forza pesate 30/25/20/10/10/5 e seed dati.
- [x] Stima posizione media, punti attesi, percentili P20-P80 e indicatore quantità stagione disputata; parità di punti senza attribuire spareggi inventati.
- [x] Ricalcolo con cache legata al contenuto di risultati/calendario/regole, solo in vista Competizioni.

## Schede giocatore: fonti derivate
- [x] Maglia abituale derivata dal numero più frequente nelle partite concluse; spareggio per ultimo utilizzo.
- [x] Ultimi cinque rating medi per partita, comprensivi di SV e avversaria, tramite vista aggregata senza ID dei votanti.
- [ ] Collegamento tra infortuni e scheda giocatore riservato allo staff, con verifiche su modello stagionale generale.

## Calendario e configurazione (ottobre 2026)
- [x] Creazione manuale fixture con data/ora Europe/Rome attraverso la stessa RPC atomica dell'import CSV.
- [x] Configurazioni competizione aggiuntive: andata/ritorno, supplementari, rigori, playoff/playout e soglie di diffida; valori salvati sui campi originali.
- [x] Associazione additiva avversarie↔competizione su `app_competition_opponents`, senza cancellazione storica.
- [ ] Editor fasi e gironi avanzati `phase_rules` con schema validato; modifiche ai partecipanti storici gestite separatamente.

## Tattica live
- [x] Storico reale delle variazioni di modulo/posizioni da `app_match_tactical_changes` per lettori e staff.
- [x] Form staff per modulo, minuto e assegnazioni giocatori con controlli su duplicati e presenza effettiva in campo dal backend.
- [x] RPC transazionale staff-only `tm_app_record_tactic` su partita operativa live, senza riscrivere la formazione iniziale.
- [ ] Deducibilità dei minuti per ruolo/comfort: non calcolata finché non sono riconciliati cambi e rientri.

- [x] Medie voti nelle pagelle del Match Center pubbliche attraverso vista aggregata, senza `voter_id`; voto personale ancora protetto da RLS.

## Coerenza fixture/tabellini — 02/10/2026
- [x] Riconciliati 11/12 tabellini `app_matches` programmaticamente con corrispondenza 1:1 verificata.
- [x] Bloccata la creazione automatica di tabellini per fixture concluse/live prive di collegamento, a protezione degli storici.
- [x] Collegamento storico Voltesea ripristinato (fixture e tabellino coincidono per stagione, competizione, orario, avversaria); dati preservati.
- [ ] Risultato storico discordante 0–0 operativo / 1–4 ufficiale: allineamento esplicito disponibile, ma richiede conferma documentale e dell'amministratore; eventi proposti non approvati automaticamente.

- [x] Sessioni di account disattivati: la UI revoca la sessione alla rilettura del profilo e non mostra più controlli staff; il backend blocca comunque l'autorizzazione tramite `private.is_staff/is_admin`.

## Revisione postpartita e risultato (ottobre 2026)
- [x] Rettifica motivata dei singoli eventi senza cambiare l'ID; ogni versione precedente e successiva salvata nello storico append-only con autore e timestamp.
- [x] Stato `provisional` / `confirmed` del risultato indipendente dallo stato `finished` della partita.
- [x] Conferma staff server-side: solo gara conclusa, punteggi uguali e nessuna proposta pendente.
- [x] Invalidazione automatica della conferma per mutazioni di score o eventi; riconciliazione dal risultato della fixture solo su conferma esplicita.
- [ ] Collaudo con credenziali reali e su dispositivi fisici non sostituibile con una pipeline simulata.

## Ultimo controllo CI — revisione postpartita
- [x] UI postpartita: rettifica per evento, conferma risultato distinta dalla conclusione partita, log consultabili; browser desktop/mobile su API simulate superato.
- [x] SQL versionato: audit append-only eventi, log allineamento punteggi, trigger invalidazione conferma e RPC protette.
- [ ] Collaudo autenticato reale e fisico: richiede sessioni e dispositivi non disponibili negli attuali test automatici.

## Stato implementazione fonte unica — ottobre 2026
- [x] Migrazione database 22 eventi in `app_match_events`: 16 con `match_id` e 6 fixture-only con `match_id = NULL`.
- [x] Unico punteggio autorevole sulla fixture, proiezione compatibile controllata dai trigger.
- [x] Letture frontend delle fixture-only event dal nuovo archivio unico e rimozione del confronto di due risultati.
- [ ] Restyling grafico timeline per la fedeltà completa allo screenshot fornito: contratto definito in `docs/architecture-single-event-result.md`, non dichiarato completato.
