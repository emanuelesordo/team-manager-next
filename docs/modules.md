# Moduli, dati e disponibilità
| Modulo | Fonte | Stato |
| --- | --- | --- |
| Home: prossimo, ultimo, bilancio | app_competition_fixtures | Consultazione |
| Classifiche per competizione | app_competition_standings | Consultazione |
| Calendario, ricerca per competizione, filtri | app_competition_fixtures | Consultazione |
| Match Center: tabellino, eventi, formazione, voti | app_matches / app_match_* | Consultazione prudente (link solo univoci) |
| Rosa, profilo, statistiche individuali | app_roster, players, app_player_season_stats | Consultazione |
| Login username/password | Edge auth-login, profiles, app_user_roles | Accesso/sessione |
| Setup squadra, stagioni, gare, disponibilità, live, votazioni, import, proiezione, PRO | Tabelle già presenti, policy in verifica | Non ancora operativo nel nuovo frontend |

## Priorità funzionali
1. Audit e test autenticati ruoli/RLS; ricostruzione certa fixture-match anche per eventuali divergenze d'orario.
2. Operazioni admin con RPC transazionali e riconciliazione fixture/app_matches.
3. Formazioni, convocazioni, timeline live/disciplinare e sistema di votazione con regole sportivo-temporali.
4. Proiezioni deterministiche e statistiche situazionali.
5. Moduli PRO del database generale, senza confondere `app_` con le tabelle senza prefisso.

Principio: il nuovo frontend non ha modificato né lo schema né i dati Supabase.
