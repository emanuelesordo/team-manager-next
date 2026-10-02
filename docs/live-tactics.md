# Modifiche tattiche durante il live

Fonte unica: `app_match_tactical_changes`. Le variazioni sono uno storico append-only, non modificano automaticamente la formazione iniziale né le statistiche di minutaggio.

La RPC `tm_app_record_tactic` richiede un utente staff attivo, un `app_matches` in stato live con fixture collegata, modulo valido la cui somma sia 10 giocatori di movimento, minuto assoluto 0–300 e da 1 a 11 posizioni con giocatori diversi. Per ogni partecipante controlla convocazione ed eleggibilità al minuto tramite la RPC esistente `tm_app_player_eligible`. La coppia formazione precedente/successiva e le posizioni sono archiviate con autore e data.

La sezione `Match Center → Gestione → Tattica` consente il salvataggio. Lo storico compare anche nella scheda Formazioni in lettura. Gli intervalli effettivamente giocati per ruolo non sono derivabili in modo completo solo da questi snapshot, pertanto non si mostrano statistiche di comfort o minuti per ruolo fittizi.
