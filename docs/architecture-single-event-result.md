# Specifica architetturale vincolante — Unico archivio eventi e un risultato (02/10/2026)

## Fonte: docs/specification-original.txt, sezioni 1, 5, 13, 16 e 20
La specifica originaria prescrive una sola fonte di verità per dato, fixture con calendario/risultato ufficiale, eventi in app_match_events, minuto NULL se ignoto e distinzione tra risultato live/provvisorio e confermato. Il risultato può essere noto anche senza tutti i marcatori. La data del concerto non è pertinente: questa è una gara calcistica.

## A. Tabella unica degli eventi
- **public.app_match_events** è l'unica tabella operativa degli eventi, per la nostra squadra e per i soli incontri tra avversarie.
- **fixture_id obbligatorio** lega ogni evento ad app_competition_fixtures.id.
- **match_id facoltativo** collega app_matches.id soltanto quando è la partita della nostra squadra. Non inventare un app_matches per incontri tra sole avversarie.
- Eventi di squadra: team_side=team/opponent relativo a home_away. Eventi importati di partite altrui: team_side=home/away assoluto. Il frontend traduce nel lato visivo.
- Un evento rimane la **stessa riga con lo stesso ID** da proposto a confermato o scartato. Il suo validation_status può essere proposed/community_confirmed/disputed/official/rejected. Proposta e conferma non sono due tabelle.
- Nome giocatore, assist, minuto, recupero e autore restano null o mancanti quando ignoti, senza valori artificiali. Le rettifiche conservano le versioni nell'audit tm_app_event_revisions, che non è una seconda tabella operativa di eventi.
- I 16 eventi di Voltesea–Caselle restano agganciati al loro match; 6 eventi preesistenti di Union Rubano–Quadrato Meticcio e Justinense–Amatori Armistizio passano in app_match_events con match_id NULL, preservando UUID e provenienza e restando proposed.
- La vecchia **app_fixture_events** viene archiviata con nome tm_legacy_fixture_events_20261002 e senza permessi di scrittura. Il nome originale viene mantenuto solo come vista di compatibilità READ-ONLY, non una seconda fonte. Le query applicative devono leggere la tabella unificata.

## B. Punteggio unico e stato del risultato
- **public.app_competition_fixtures.home_score / away_score** è l'unico risultato autorevole in live e postpartita.
- app_matches.home_score / away_score restano temporaneamente come **proiezione di compatibilità** per funzioni SQL già operative, aggiornata dai trigger; nessun codice deve trattarli come risultato autonomo. La migrazione ha riconciliato il precedente 0–0 in proiezione con la fixture 1–4 senza alterare quest'ultima.
- app_matches.status / fixture.status (scheduled,live,finished) descrivono la fase di gara e NON la validazione del risultato.
- L'unico **campo di validazione del risultato** è app_matches.result_review_status: provisional o confirmed. Una partita finished può essere ancora provisional. La conferma richiede i punteggi della fixture e nessun evento aperto. La modifica di un evento o punteggio riporta provisional.
- Non mostrare la distinzione artificiale «risultato operativo 0–0» e «risultato ufficiale 1–4»; il risultato visualizzato è sempre quello della fixture. Non creare più copie del punteggio o tabelle di eventi per stati diversi.
- I parziali grafici si ricostruiscono solo da eventi gol conosciuti e completi oppure da snapshot con provenienza registrata. Se i gol sono parziali, NON inventare punteggi intermedi o marcatori.

## C. Timeline grafica secondo screenshot fornito il 2 ottobre
- Risultato FT in alto. Minuti centrali, in ordine decrescente nel riepilogo: 86', 83', ecc.; minuto ignoto = — senza inventarlo.
- Eventi casa nella metà sinistra e ospiti nella metà destra; colonna minuti centrale; mantenere leggibilità su mobile.
- Gol: pallone e pill punteggio solo quando il parziale è verificato, marcatore in grassetto, assist in grigio; «Gol avversario»/«Marcatore non indicato» quando l'autore non è noto.
- Cambi: frecce rosse/verdi, subentrante in grassetto, uscente in grigio; supportare uscita senza ingresso.
- Gialli, blu, rossi: icone distintive a card/cartellino; espulsione e numero quando noto.
- Separatori recupero («RECUPERO +7'» soltanto con informazione esplicita), HT, FT; nessuna duplicazione del numero evento.
- Un'unica timeline utilizzata sia per la lettura che per la gestione, con pulsanti staff aggiunti senza replicare eventi.

## D. Regressioni e vincoli
- Prima/dopo migrazione: 16 righe match e 6 fixture-only, **22 eventi univoci**.
- Compatibilità: la vecchia vista read-only espone i 6 fixture-only senza storage autonomo aggiornabile.
- Per i risultati con score noto, differenze fra fixture e proiezione app_matches = 0.
- Nessuna approvazione automatica dei 16 eventi Voltesea: risultano ancora proposed, mentre result_review_status resta provisional. Non attribuire confirmed a una gara storica solo perché l'utente dice di averla già confermata: segnalare il disallineamento fattuale e consentire allo staff la revisione.
- RLS mantenuta, autorizzazioni staff per le scritture, fixture-only senza partita operativa artificiale.
- Il restyling visivo integrale della timeline è requisito di UI separato dalla migrazione schema: non dichiararlo già completato finché non testato e pubblicato.
