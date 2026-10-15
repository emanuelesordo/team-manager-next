# Statistiche descrittive eventi
I metadati `goal_details`, `disciplinary_reason`, `substitution_motivation` in `app_match_events.payload` alimentano la scheda giocatore e «Numeri» squadra/giocatori, senza duplicare gol o minuti delle viste SQL ufficiali.
- Solo eventi `official`/`community_confirmed`, eventi con `counted_in_score=false` esclusi; esclusi test e proposte.
- Un evento per ID. I valori assenti sono «non compilati», non vengono inferiti; il denominatore è mostrato come `compilati / eventi`.
- Gol: parte del corpo, tipo di gioco, dinamica, distanza; cartellini: motivo; cambi: motivo.
- Conteggi per giocatore: `player_id` dell'evento (per le sostituzioni identifica l'uscente). Aggregazione squadra sui propri eventi `team_side=team`.
- Il dettaglio dei gol subiti da avversari non è attribuito ai giocatori Caselle: può essere esteso in futuro a un pannello specifico sui gol subiti.
