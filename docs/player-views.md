# Viste derivate giocatori

Le viste `tm_player_habitual_shirts` e `tm_player_recent_votes` sono state applicate in Supabase.

- **Maglia abituale**: deriva dalla moda dei numeri registrati su `app_match_players` per `app_matches.status='finished'`. A parità prevale data partita più recente, poi numero crescente/decrescente deterministico. Non viene scritto alcun valore nell'anagrafica.
- **Ultime cinque valutazioni**: medie per player/partita da `app_match_ratings` soltanto su `app_matches` concluse; `NULL` indica SV; conteggio separato SV e voti validi, nessun `voter_id` nel risultato. Il risultato della query non è salvato.
- L'app legge le viste pubbliche aggregate, ma non allarga la policy di lettura della tabella dei singoli voti.

Sicurezza: per entrambe le viste sono concessi solo SELECT anon/authenticated senza INSERT/UPDATE/DELETE.
