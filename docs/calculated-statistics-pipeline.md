# Pipeline statistiche materializzate (14 ottobre 2026)

## Principio
Supabase è il produttore dei risultati definitivi. Il frontend **non deve** inventare o risommare indipendentemente gol in campo, gol subiti, plus/minus, presenze, subentri e minuti.

## Fonti e prodotti
| Livello | Oggetto | Ruolo |
|---|---|---|
| Input | `app_match_events` | Eventi ufficiali/confermati, identificativi e tempi |
| Input | `app_match_players` | Titolari, panchina, partecipanti |
| Input | `app_matches`, `app_competition_fixtures`, `app_competitions` | Status, durata e risultato finale |
| Calcolo canonico | `private.tm_player_match_participation` | Minuti/intervalli verificati |
| **Materializzazione** | `public.app_match_player_calculated` | Presenza, minuti, GF/GS durante la presenza, plus/minus, copertura per giocatore e partita |
| **Vista stagionale** | `public.app_player_calculated_season` | Totali ufficiali più impatto aggregato delle righe materializzate |
| UI | `fresh/api.js`, `fresh/main.js`, `fresh/player-intelligence.js` | Lettura dei valori SQL; gli eventi locali restano dettaglio esplorativo |

## Automaticità
I trigger `tm_refresh_event_calculated`, `tm_refresh_lineup_calculated`, `tm_refresh_match_calculated`, `tm_refresh_fixture_calculated` operano dopo INSERT/UPDATE/DELETE (fixture: cambi score/status) e richiamano `private.tm_app_refresh_match_calculated` nella **stessa transazione**.

Se una modifica fallisce, falliscono anche i ricalcoli e la modifica viene annullata. Il trigger ricalcola la partita interessata, non la stagione intera. La vista stagionale si aggiorna automaticamente dalla tabella materializzata.

Il browser aggiorna i dati dopo le principali scritture amministrative e RPC e non conserva come autorevoli i risultati calcolati localmente.

## Qualità e limiti
- Gol e intervalli validi devono ricondurre al punteggio ufficiale. I risultati non verificabili restano `NULL` con `score_coverage='unavailable'`.
- Il conteggio di minuti usa `private.tm_player_match_participation`, non una seconda formula JavaScript.
- **Ancora da trasferire in cache server-side:** classificazioni dettagliate dei gol (pareggio, vantaggio, rimonta), suddivisioni on/off per intervalli di tempo, rendimento contro ranghi attesi, grafici previsionali e alcune distribuzioni avanzate; tali metriche non sono ancora tutte materializzate. Le predizioni restano modelli e non dati ufficiali.
- Attualmente gli eventi ufficiali di partite concluse vengono ricostruiti sincronicamente; monitorare il costo per partite molto affollate di eventi e in import bulk. Potrà essere opportuna una coda asincrona con versioning e controllo freshness quando il volume cresce.

## Verifiche eseguite
- Backfill: 77 record, somma minuti 979 + 968 + 990 = 2.937, discrepanze su minuti/presenze rispetto alla vista privata: **0**.
- Peruzzo: tre partite, GF in campo 8, GS in campo 3, plus/minus +5 e minuti 165.
- Lettura anonima RLS: 77 righe, GS di Peruzzo = 3.
- Modifica temporanea del minuto di un gol avversario, in transazione poi annullata: la cache cambia da 1 a 0 nell'incontro coinvolto senza interventi JavaScript, confermando il trigger.
- Migrazioni: `20261014_tm_event_driven_match_player_cache.sql` e `20261014_tm_calculated_season_rollup.sql`.

## Audit utile
```sql
SELECT m.kickoff_at::date played, c.player_id,c.minutes,c.goals_for_on,c.goals_against_on,c.plus_minus,c.score_coverage
FROM public.app_match_player_calculated c
JOIN public.app_matches m ON m.id=c.match_id
ORDER BY m.kickoff_at,c.player_id;
```
