# Voti partita

La tabella app_match_ratings mantiene un solo record per match, giocatore e votante. Rating numerico da 1 a 10 con step 0,5; valore NULL per SV. Un SV persistito è distinto da assenza di valutazione e viene escluso dalle medie.

La funzione SECURITY INVOKER tm_app_save_rating opera con auth.uid e usa upsert; policy RLS RESTRICTIVE impediscono valutazioni per partite non finite e giocatori non entrati. Partecipazione valida: started=true oppure ingresso come secondary_player_id in sostituzione ufficiale o community_confirmed. I sostituti mai entrati e gli eventi pending non abilitano il voto.

La vista app_player_season_stats calcola media delle medie partita, senza ponderare per numero di votanti. I dati restano su Supabase e sono gestiti direttamente dalla UI Match Center.

La funzione tm_app_match_action assegna gli autogol alla squadra che ne beneficia e applica la medesima regola in caso di annullamento.
