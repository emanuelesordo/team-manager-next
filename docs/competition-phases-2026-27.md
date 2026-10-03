# Struttura delle competizioni e delle fasi — CSI 2026/27

## Gerarchia modificabile
- Serie A1: livello `1`
- Serie A2: livello `2`
- Serie B: livello `3`
- Fasi successive: sottocompetizioni collegate tramite `parent_competition_id`, con livello modificabile (es. `3.1`, `3.2`, `3.11`). I numeri sono descrittivi e non determinano automaticamente le promozioni.
- Modalità della fase: eliminazione diretta (`knockout`), nuovo girone (`league`), girone con eventuale finale (`league_then_final`).
- Fasi superiori e inferiori possono essere distinte: Play Off, Play Out, Primavera/consolazione e finale.

## Serie B 2026/27
- Regular Season girone D: **13 squadre**, incluso Calcio Caselle. Competizione esistente, livello `3`, codice girone `D`.
- Regular Season girone E: **12 squadre**. Attualmente da censire prima di qualificare le squadre.
- Play Off Serie B (`3.1` suggerito, modificabile): prime 5 di D + prime 5 di E, **10 squadre**.
- Torneo Primavera (`3.2` suggerito, modificabile): dalla sesta posizione in poi in entrambi i gironi; **8 + 7 = 15 squadre**.
- **Ogni fase parte da 0 punti**. Nessun risultato o incontro della Regular Season contribuisce alla classifica della nuova fase.
- Play Off: girone unico, sola andata: **9 partite per squadra, 45 partite complessive**.
- Primavera: girone unico, sola andata: **14 partite per squadra, 105 partite complessive**, 15 giornate con un turno di riposo per squadra.
- Se due squadre si sono già affrontate nella Regular Season, nella nuova fase si **inverte casa/trasferta**; l'incontro è comunque un NUOVO record, con nuovo ID e risultato inizialmente assente.
- Per gli altri abbinamenti il generatore bilancia le gare interne/esterne; i calendari effettivi richiedono date e approvazione.
- È prevista una finale distinta e collegata alla fase playoff se la formula la richiede.

## Regole di integrità
1. `app_competitions.id` identifica ogni fase, indipendente da `parent_competition_id`.
2. `app_competition_phase_sources` collega le due competizioni di origine e gli intervalli di piazzamento.
3. `app_competition_phase_entries` registra partecipanti per **ID** `teams.id` o `app_opponents.id`; mai mediante confronto dei nomi.
4. La conferma dei qualificati è bloccata finché le gare di entrambi i gironi non sono definitivamente concluse; se due squadre sono a pari punti sul confine di qualificazione, serve l'applicazione del criterio CSI ufficiale, non un ordinamento arbitrario.
5. Dopo la creazione di partite nella fase, non è consentito rigenerare automaticamente la lista qualificati, per proteggere i dati.
6. L'anteprima degli abbinamenti non registra gare ufficiali e lascia le date vuote. Serve definire e approvare il calendario prima dell'inserimento definitivo.
7. Lo scoring dei campionati si applica soltanto alle gare del rispettivo `competition_id`.

## Stato iniziale
È stata configurata soltanto la **Serie B girone D** esistente con il livello `3`. Non sono state inventate squadre del girone E, classifica, risultati né date di futuri incontri. Il setup permette la creazione controllata delle sottocompetizioni.
