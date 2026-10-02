# Revisione postpartita (da team-manager.txt §§ 16–22)

- Gli eventi sono in `app_match_events`, conservando stato, proponente, ufficializzatore e data.
- I risultati live/provvisori e quelli ufficiali sono distinti. La conoscenza parziale dei marcatori non impedisce un risultato ufficiale e non autorizza inventare eventi.
- `tm_app_review_event`: staff-only, match collegato, stato live/finished, controllo ottimistico di `validation_status`, approvazione `official` o scarto logico `rejected`. Nessun DELETE o aggiornamento punteggi.
- Un evento `counted_in_score=true` non può essere scartato da questa revisione: usare prima la console di rettifica risultato; evitare inconsistenze sui gol.
- La pagina Gestione → Eventi espone proposte, eventi ufficiali e scartati; mostra cronologia, minuto anche NULL, recupero, giocatore e assist quando disponibili, confronto tra fixture e tabellino e numero di gol con eventi ufficializzati.
- NON ufficializza in blocco i 16 eventi storici Voltesea–Caselle e NON altera 0–0 operativo / 1–4 ufficiale. Convalida umana necessaria.
- Test inclusi: partita senza eventi, risultato con marcatori parziali, recupero, autogol, rosso, blu, sostituzione e minuti NULL, annullamento logico.

Limiti attuali: rettifica dettagliata in-place di un evento e passaggio di stato finale/provvisorio separato sono ulteriori sviluppi; non si afferma che siano completati. Il test browser è simulato e non sostituisce la prova autenticata su produzione.
