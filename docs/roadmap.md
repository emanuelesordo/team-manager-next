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
