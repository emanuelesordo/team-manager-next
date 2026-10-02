# Statistiche e fonti

- `app_competition_fixtures`: bilanci, gol, clean sheet, percentuali e sede. Solo gare `finished` con punteggio numerico.
- `app_match_events`: proposte, eventi ufficializzati e validazioni. Per statistiche certe usare solo `official` e `community_confirmed`.
- `app_fixture_events`: cronologia separata della fixture, consultabile nel Match Center. Non sommare eventi omologhi da fonti diverse.
- Rimonte e punteggio prima del gol: conteggi solo se tutti i gol hanno minuti, status validato e tornano esattamente con il punteggio ufficiale. Altrimenti dato *non calcolabile*, non zero.
- Minuti superiorità, plus/minus individuale e rating pesato restano senza stima quando mancano segmenti della timeline. `minutes_played` memorizzato non prova da solo l'effettiva durata ricostruita.
