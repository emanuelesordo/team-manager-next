# Roadmap e stato verificabile

## Consegnato nella baseline

- [x] Struttura standalone per GitHub Pages, moduli ES
- [x] Palette nera/gialla/bianca e responsive mobile dedicato
- [x] Navigazione app, filtri, card, carosello, modali, stati vuoti
- [x] Configurazione per Supabase esistente
- [x] Login tramite Edge Function esistente
- [x] Letture di stagioni, competizioni, fixture, classifica, rosa, match e statistiche con le policy in essere
- [x] Specifica integrale e documentazione tecnica/grafica separata
- [ ] Pubblicazione: richiede creazione nuova repository e attivazione Pages da proprietario
- [ ] Collaudo end-to-end autenticato tramite browser su Pages

## Fasi successive

1. Audit operativo di PK/FK/unique/check, trigger, RPC, RLS di ogni scrittura, con test su copia di sviluppo.
2. **Admin**: setup squadra, stagioni, competizioni, avversarie e import, con validazione server-side.
3. **Calendario**: scrittura e riconciliazione transazionale delle fixture e match operativi.
4. **Match Center**: disponibilità, convocazioni, modulo tattico, titolari, panchina, non convocati, eventi live e cronometro.
5. **Motore eventi**: sostituzioni, gol/assist, rossi, blu e rientri automatici, recuperi, eventi senza minuto, proposte e validazione.
6. **Voti**: SV e valori da 1 a 10 a step 0,5, filtri eleggibilità e media minutaggio.
7. **Statistiche avanzate**: timeline accurata, plus/minus, rimonte, situazionali e controllo doppie presenze.
8. **Classifica proiettata**: 10.000 simulazioni riproducibili, criteri variabili di spareggio e incertezza esplicita.
9. **PRO**: allenamenti, presenze, idoneità, quote, multe, contratti, staff ed elezioni.

### Accettazione funzionale

Per ogni fase: test partita senza eventi; risultati parziali; recupero; blu e rientro; rosso; cambio con/senza entrata; minuto nullo; SV; cambio stagione; competizione senza classifica; ruoli anon/fan/giocatore/admin; accesso non autorizzato; import ripetuta. La specifica completa in `specification-original.txt` rimane la fonte di dettaglio.
